import AVFoundation
import ExpoModulesCore

public class DualCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DualCamera")

    // True on iPhone XS / XR and newer: the hardware can run both cameras at once.
    Constants([
      "isSupported": AVCaptureMultiCamSession.isMultiCamSupported
    ])

    View(DualCameraView.self) {
      Events("onReady", "onError", "onRecordingFinished")

      Prop("pipCorner") { (view: DualCameraView, corner: String) in
        view.pipCorner = corner
      }
      Prop("pipScale") { (view: DualCameraView, scale: Double) in
        view.pipScale = CGFloat(scale)
      }
      Prop("swapped") { (view: DualCameraView, swapped: Bool) in
        view.swapped = swapped
      }
      Prop("muted") { (view: DualCameraView, muted: Bool) in
        view.muted = muted
      }
      Prop("torch") { (view: DualCameraView, on: Bool) in
        view.setTorch(on)
      }

      AsyncFunction("startRecording") { (view: DualCameraView, promise: Promise) in
        view.startRecording { error in
          if let error = error { promise.reject("E_RECORD", error.localizedDescription) } else { promise.resolve() }
        }
      }

      AsyncFunction("stopRecording") { (view: DualCameraView, promise: Promise) in
        view.stopRecording { result, error in
          if let error = error {
            promise.reject("E_RECORD", error.localizedDescription)
          } else {
            promise.resolve(result)
          }
        }
      }
    }
  }
}
