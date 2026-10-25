import AVFoundation
import CoreImage
import CoreImage.CIFilterBuiltins

/**
 * Takes the two camera streams plus the mic and writes one .mp4: the main
 * camera full-frame, the other one as a rounded picture-in-picture, exactly
 * as previewed. Every call lands on the view's data queue, so the state here
 * is never touched from two threads at once.
 */
final class DualCameraRecorder: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
  weak var backOutput: AVCaptureVideoDataOutput?
  weak var frontOutput: AVCaptureVideoDataOutput?
  weak var audioOutput: AVCaptureAudioDataOutput?

  var swapped = false
  var muted = false
  var pipCorner = "topRight"
  var pipScale: CGFloat = 0.3
  var onFinished: (([String: Any]?, Error?) -> Void)?

  private let ciContext = CIContext(options: [.cacheIntermediates: false])
  private var latestBack: CVPixelBuffer?
  private var latestFront: CVPixelBuffer?

  private var writer: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var audioInput: AVAssetWriterInput?
  private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var outputURL: URL?
  private var startTime: CMTime?
  private var lastVideoTime: CMTime?
  private var recording = false
  private var size = CGSize.zero

  private func err(_ message: String) -> NSError {
    NSError(domain: "DualCameraRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  // MARK: Control

  func start() throws {
    guard !recording else { return }
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("walkthrough", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let url = dir.appendingPathComponent("walk-\(Int(Date().timeIntervalSince1970)).mp4")
    try? FileManager.default.removeItem(at: url)

    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    writer.shouldOptimizeForNetworkUse = true
    self.writer = writer
    self.outputURL = url
    self.startTime = nil
    self.lastVideoTime = nil
    self.videoInput = nil
    self.audioInput = nil
    self.adaptor = nil
    // Writer inputs are created on the first frame, once the real size is known.
    recording = true
  }

  func stop(_ done: @escaping ([String: Any]?, Error?) -> Void) {
    guard recording, let writer = writer else {
      done(nil, err("Not recording."))
      return
    }
    recording = false
    let url = outputURL
    let duration: Double = {
      guard let s = startTime, let e = lastVideoTime else { return 0 }
      return CMTimeGetSeconds(CMTimeSubtract(e, s))
    }()
    let w = Int(size.width), h = Int(size.height)

    guard writer.status == .writing else {
      writer.cancelWriting()
      let e = writer.error ?? err("Nothing was recorded.")
      done(nil, e)
      onFinished?(nil, e)
      return
    }
    videoInput?.markAsFinished()
    audioInput?.markAsFinished()
    writer.finishWriting { [weak self] in
      let result: [String: Any]? = writer.status == .completed && url != nil
        ? ["uri": url!.absoluteString, "duration": duration, "width": w, "height": h]
        : nil
      let error = writer.status == .completed ? nil : (writer.error ?? self?.err("Could not save the clip."))
      done(result, error)
      self?.onFinished?(result, error)
      self?.writer = nil
    }
  }

  // MARK: Frames

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    if output === audioOutput {
      handleAudio(sampleBuffer)
      return
    }
    guard let pixel = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let isBack = output === backOutput
    if isBack { latestBack = pixel } else { latestFront = pixel }

    // The main camera drives the clip's frame rate; the other one just
    // contributes its most recent frame.
    let mainIsBack = !swapped
    guard isBack == mainIsBack, recording else { return }
    let time = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    write(main: pixel, pip: mainIsBack ? latestFront : latestBack, at: time)
  }

  private func ensureInputs(for pixel: CVPixelBuffer) -> Bool {
    guard let writer = writer else { return false }
    if videoInput != nil { return true }
    let width = CVPixelBufferGetWidth(pixel)
    let height = CVPixelBufferGetHeight(pixel)
    size = CGSize(width: width, height: height)

    let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 6_000_000,
        AVVideoExpectedSourceFrameRateKey: 30,
        AVVideoMaxKeyFrameIntervalKey: 60,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
      ],
    ])
    video.expectsMediaDataInRealTime = true
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
      kCVPixelBufferIOSurfacePropertiesKey as String: [String: Any](),
    ])
    guard writer.canAdd(video) else { return false }
    writer.add(video)
    videoInput = video
    self.adaptor = adaptor

    if !muted, let audioOutput = audioOutput {
      var settings = audioOutput.recommendedAudioSettingsForAssetWriter(writingTo: .mp4) ?? [:]
      if settings.isEmpty {
        settings = [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVNumberOfChannelsKey: 1,
          AVSampleRateKey: 44_100,
          AVEncoderBitRateKey: 96_000,
        ]
      }
      let audio = AVAssetWriterInput(mediaType: .audio, outputSettings: settings)
      audio.expectsMediaDataInRealTime = true
      if writer.canAdd(audio) {
        writer.add(audio)
        audioInput = audio
      }
    }
    return true
  }

  private func write(main: CVPixelBuffer, pip: CVPixelBuffer?, at time: CMTime) {
    guard let writer = writer, ensureInputs(for: main), let videoInput = videoInput, let adaptor = adaptor else { return }
    if writer.status == .unknown {
      guard writer.startWriting() else { return }
      writer.startSession(atSourceTime: time)
      startTime = time
    }
    guard writer.status == .writing, videoInput.isReadyForMoreMediaData else { return }

    var composed = CIImage(cvPixelBuffer: main)
    if let pip = pip {
      composed = overlay(pip: CIImage(cvPixelBuffer: pip), on: composed)
    }

    guard let pool = adaptor.pixelBufferPool else { return }
    var out: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &out)
    guard let target = out else { return }
    ciContext.render(composed, to: target, bounds: composed.extent, colorSpace: CGColorSpaceCreateDeviceRGB())
    if adaptor.append(target, withPresentationTime: time) {
      lastVideoTime = time
    }
  }

  /// Same geometry as the preview: a 3:4 bubble, `pipScale` of the width, in the chosen corner.
  private func overlay(pip: CIImage, on main: CIImage) -> CIImage {
    let W = main.extent.width, H = main.extent.height
    let w = max(120, W * pipScale)
    let h = w * 4 / 3
    // Center-crop the 9:16 source down to 3:4 before scaling.
    let srcW = pip.extent.width, srcH = pip.extent.height
    let cropH = min(srcH, srcW * 4 / 3)
    let crop = CGRect(x: 0, y: (srcH - cropH) / 2, width: srcW, height: cropH)
    let scale = w / srcW
    let margin = W * 0.035
    // CoreImage's origin is bottom-left; "top" offsets mirror the preview's
    // room for the top bar and the bottom controls.
    let topInset = H * 0.11
    let bottomInset = H * 0.26
    var x = W - w - margin
    var y = H - topInset - h
    switch pipCorner {
    case "topLeft": x = margin
    case "bottomLeft": x = margin; y = bottomInset
    case "bottomRight": y = bottomInset
    default: break
    }
    let placed = pip.cropped(to: crop)
      .transformed(by: CGAffineTransform(translationX: -crop.minX, y: -crop.minY))
      .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
      .transformed(by: CGAffineTransform(translationX: x, y: y))

    let rounded = CIFilter.roundedRectangleGenerator()
    rounded.extent = CGRect(x: x, y: y, width: w, height: h)
    rounded.radius = Float(w * 0.1)
    rounded.color = .white
    let mask = rounded.outputImage?.cropped(to: main.extent) ?? CIImage.empty()

    let blend = CIFilter.blendWithMask()
    blend.inputImage = placed
    blend.backgroundImage = main
    blend.maskImage = mask
    return (blend.outputImage ?? main).cropped(to: main.extent)
  }

  private func handleAudio(_ sampleBuffer: CMSampleBuffer) {
    guard recording, !muted, let writer = writer, writer.status == .writing,
          let audioInput = audioInput, audioInput.isReadyForMoreMediaData,
          let start = startTime else { return }
    let ts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    guard CMTimeCompare(ts, start) >= 0 else { return }
    audioInput.append(sampleBuffer)
  }
}
