require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DualCamera'
  s.version        = package['version']
  s.summary        = 'Front + rear camera recording in one clip (AVCaptureMultiCamSession).'
  s.description    = 'Walk-through video: rear camera full frame, front camera picture-in-picture, one audio track.'
  s.author         = 'Job Site Check In'
  s.homepage       = 'https://jobsitecheckin.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
