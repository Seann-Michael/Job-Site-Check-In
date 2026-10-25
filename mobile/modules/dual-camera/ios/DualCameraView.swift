import AVFoundation
import ExpoModulesCore
import UIKit

/**
 * Both cameras at once: rear camera as the main picture, front camera as a
 * picture-in-picture bubble, one microphone — so a contractor can narrate a
 * walk-through while showing what they're talking about.
 *
 * Preview is two native preview layers over one AVCaptureMultiCamSession.
 * Recording composites each rear frame with the latest front frame into a
 * single portrait clip (see DualCameraRecorder), so what gets saved is the
 * same picture-in-picture the user saw.
 */
class DualCameraView: ExpoView {
  let onReady = EventDispatcher()
  let onError = EventDispatcher()
  let onRecordingFinished = EventDispatcher()

  var pipCorner: String = "topRight" { didSet { setNeedsLayout() } }
  var pipScale: CGFloat = 0.3 { didSet { setNeedsLayout() } }
  var swapped: Bool = false {
    didSet {
      setNeedsLayout()
      recorder.swapped = swapped
    }
  }
  var muted: Bool = false { didSet { recorder.muted = muted } }

  private let session = AVCaptureMultiCamSession()
  private let sessionQueue = DispatchQueue(label: "dualcamera.session")
  private let dataQueue = DispatchQueue(label: "dualcamera.data", qos: .userInitiated)
  private let recorder = DualCameraRecorder()

  private var backDevice: AVCaptureDevice?
  private var frontDevice: AVCaptureDevice?
  private let backOutput = AVCaptureVideoDataOutput()
  private let frontOutput = AVCaptureVideoDataOutput()
  private let audioOutput = AVCaptureAudioDataOutput()

  private let backLayer = AVCaptureVideoPreviewLayer()
  private let frontLayer = AVCaptureVideoPreviewLayer()
  private var configured = false
  private var observers: [NSObjectProtocol] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    clipsToBounds = true
    backLayer.videoGravity = .resizeAspectFill
    frontLayer.videoGravity = .resizeAspectFill
    frontLayer.cornerRadius = 14
    frontLayer.masksToBounds = true
    frontLayer.borderWidth = 1.5
    frontLayer.borderColor = UIColor.white.withAlphaComponent(0.85).cgColor
    layer.addSublayer(backLayer)
    layer.addSublayer(frontLayer)

    recorder.onFinished = { [weak self] result, error in
      DispatchQueue.main.async {
        if let error = error {
          self?.onError(["message": error.localizedDescription])
        } else if let result = result {
          self?.onRecordingFinished(result)
        }
      }
    }

    // Leaving the app mid-walk-through ends the clip cleanly instead of losing it.
    observers.append(NotificationCenter.default.addObserver(
      forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.stopRecording { _, _ in }
    })
    observers.append(NotificationCenter.default.addObserver(
      forName: AVCaptureSession.runtimeErrorNotification, object: session, queue: .main
    ) { [weak self] note in
      let err = note.userInfo?[AVCaptureSessionErrorKey] as? NSError
      self?.onError(["message": err?.localizedDescription ?? "Camera stopped unexpectedly."])
    })
  }

  deinit {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    let s = session
    sessionQueue.async { if s.isRunning { s.stopRunning() } }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      sessionQueue.async { [weak self] in self?.startIfNeeded() }
    } else {
      sessionQueue.async { [weak self] in
        guard let self = self, self.session.isRunning else { return }
        self.session.stopRunning()
      }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    let main = swapped ? frontLayer : backLayer
    let pip = swapped ? backLayer : frontLayer
    main.frame = bounds
    main.cornerRadius = 0
    main.borderWidth = 0
    main.zPosition = 0

    let margin: CGFloat = 12
    let safeTop = safeAreaInsets.top + 64
    let safeBottom = safeAreaInsets.bottom + 230
    let w = max(90, bounds.width * pipScale)
    let h = w * 4 / 3
    var x = bounds.width - w - margin
    var y = safeTop + margin
    switch pipCorner {
    case "topLeft": x = margin
    case "bottomLeft": x = margin; y = bounds.height - safeBottom - h
    case "bottomRight": y = bounds.height - safeBottom - h
    default: break
    }
    pip.frame = CGRect(x: x, y: y, width: w, height: h)
    pip.cornerRadius = 14
    pip.borderWidth = 1.5
    pip.zPosition = 1
    CATransaction.commit()
    recorder.pipCorner = pipCorner
    recorder.pipScale = pipScale
  }

  // MARK: - Session

  private func fail(_ message: String) {
    DispatchQueue.main.async { self.onError(["message": message]) }
  }

  private func startIfNeeded() {
    if !configured {
      guard AVCaptureMultiCamSession.isMultiCamSupported else {
        fail("This phone can't run both cameras at once.")
        return
      }
      do {
        try configure()
        configured = true
      } catch {
        fail(error.localizedDescription)
        return
      }
    }
    if !session.isRunning {
      session.startRunning()
      DispatchQueue.main.async { self.onReady([:]) }
    }
  }

  private func pickFormat(_ device: AVCaptureDevice) throws {
    // 720p binned formats are what Apple's multi-cam sample uses: they keep
    // both cameras under the hardware/thermal budget on every supported phone.
    let candidates = device.formats.filter { format in
      guard format.isMultiCamSupported else { return false }
      let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
      return dims.width == 1280 && dims.height == 720 && format.isVideoBinned
    }
    let fallback = device.formats.filter { $0.isMultiCamSupported }
      .sorted { a, b in
        let da = CMVideoFormatDescriptionGetDimensions(a.formatDescription)
        let db = CMVideoFormatDescriptionGetDimensions(b.formatDescription)
        return da.width * da.height < db.width * db.height
      }
      .first { f in
        let d = CMVideoFormatDescriptionGetDimensions(f.formatDescription)
        return d.width >= 1280
      }
    guard let format = candidates.first ?? fallback else {
      throw NSError(domain: "DualCamera", code: 1, userInfo: [NSLocalizedDescriptionKey: "No compatible camera format."])
    }
    try device.lockForConfiguration()
    device.activeFormat = format
    let fps = CMTime(value: 1, timescale: 30)
    device.activeVideoMinFrameDuration = fps
    device.activeVideoMaxFrameDuration = fps
    device.unlockForConfiguration()
  }

  private func attach(device: AVCaptureDevice, output: AVCaptureVideoDataOutput, previewLayer: AVCaptureVideoPreviewLayer, mirrored: Bool) throws {
    try pickFormat(device)
    let input = try AVCaptureDeviceInput(device: device)
    guard session.canAddInput(input) else { throw err("Camera is in use by another app.") }
    session.addInputWithNoConnections(input)

    guard let port = input.ports(for: .video, sourceDeviceType: device.deviceType, sourceDevicePosition: device.position).first else {
      throw err("Camera port unavailable.")
    }

    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    output.alwaysDiscardsLateVideoFrames = true
    output.setSampleBufferDelegate(recorder, queue: dataQueue)
    guard session.canAddOutput(output) else { throw err("Could not add camera output.") }
    session.addOutputWithNoConnections(output)

    let dataConnection = AVCaptureConnection(inputPorts: [port], output: output)
    guard session.canAddConnection(dataConnection) else { throw err("Could not connect camera.") }
    session.addConnection(dataConnection)
    orient(dataConnection, mirrored: mirrored)

    previewLayer.setSessionWithNoConnection(session)
    let previewConnection = AVCaptureConnection(inputPort: port, videoPreviewLayer: previewLayer)
    guard session.canAddConnection(previewConnection) else { throw err("Could not connect preview.") }
    session.addConnection(previewConnection)
    orient(previewConnection, mirrored: mirrored)
  }

  private func orient(_ connection: AVCaptureConnection, mirrored: Bool) {
    if #available(iOS 17.0, *) {
      if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
    } else if connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }
    if connection.isVideoMirroringSupported {
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = mirrored
    }
  }

  private func err(_ message: String) -> NSError {
    NSError(domain: "DualCamera", code: 2, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private func configure() throws {
    session.beginConfiguration()
    defer { session.commitConfiguration() }

    guard let back = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          let front = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
      throw err("Both cameras are needed for walk-through mode.")
    }
    backDevice = back
    frontDevice = front
    try attach(device: back, output: backOutput, previewLayer: backLayer, mirrored: false)
    try attach(device: front, output: frontOutput, previewLayer: frontLayer, mirrored: true)
    recorder.backOutput = backOutput
    recorder.frontOutput = frontOutput

    // One microphone. The session configures the audio route; we nudge it to
    // the front-facing element so the person talking to the phone is clearest.
    if let mic = AVCaptureDevice.default(for: .audio) {
      let micInput = try AVCaptureDeviceInput(device: mic)
      if session.canAddInput(micInput) {
        session.addInputWithNoConnections(micInput)
        audioOutput.setSampleBufferDelegate(recorder, queue: dataQueue)
        if session.canAddOutput(audioOutput) {
          session.addOutputWithNoConnections(audioOutput)
          if let port = micInput.ports.first(where: { $0.mediaType == .audio }) {
            let c = AVCaptureConnection(inputPorts: [port], output: audioOutput)
            if session.canAddConnection(c) { session.addConnection(c) }
          }
        }
        recorder.audioOutput = audioOutput
      }
    }
    preferFrontMic()
  }

  private func preferFrontMic() {
    let audio = AVAudioSession.sharedInstance()
    guard let input = audio.availableInputs?.first(where: { $0.portType == .builtInMic }) else { return }
    try? audio.setPreferredInput(input)
    if let front = input.dataSources?.first(where: { $0.orientation == .front }) {
      try? input.setPreferredDataSource(front)
      if let pattern = front.supportedPolarPatterns?.first(where: { $0 == .cardioid }) {
        try? front.setPreferredPolarPattern(pattern)
      }
    }
  }

  func setTorch(_ on: Bool) {
    sessionQueue.async { [weak self] in
      guard let device = self?.backDevice, device.hasTorch else { return }
      try? device.lockForConfiguration()
      device.torchMode = on && device.isTorchAvailable ? .on : .off
      device.unlockForConfiguration()
    }
  }

  // MARK: - Recording

  func startRecording(_ done: @escaping (Error?) -> Void) {
    sessionQueue.async { [weak self] in
      guard let self = self else { return }
      guard self.session.isRunning else {
        done(self.err("Camera isn't ready yet."))
        return
      }
      self.dataQueue.async {
        do {
          try self.recorder.start()
          done(nil)
        } catch {
          done(error)
        }
      }
    }
  }

  func stopRecording(_ done: @escaping ([String: Any]?, Error?) -> Void) {
    dataQueue.async { [weak self] in
      guard let self = self else { return }
      self.recorder.stop { result, error in done(result, error) }
    }
  }
}
