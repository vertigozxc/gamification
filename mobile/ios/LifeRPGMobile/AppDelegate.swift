import Expo
import React
import ReactAppDependencyProvider
import AuthenticationServices
import UIKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
    // Prefer the embedded jsbundle whenever it is present in the .app — this
    // makes the binary work on real devices without Metro/local-network access.
    if let embedded = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      return embedded
    }
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return nil
#endif
  }
}

@objc(AuthSessionModule)
class AuthSessionModule: NSObject, RCTBridgeModule, ASWebAuthenticationPresentationContextProviding {
  private var currentSession: ASWebAuthenticationSession?

  static func moduleName() -> String! {
    return "AuthSessionModule"
  }

  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc(openAuthSession:callbackScheme:resolver:rejecter:)
  func openAuthSession(
    _ urlString: String,
    callbackScheme: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = URL(string: urlString) else {
      reject("invalid_url", "Invalid auth URL", nil)
      return
    }

    DispatchQueue.main.async {
      let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
        self.currentSession = nil

        if let nsError = error as NSError? {
          if nsError.domain == ASWebAuthenticationSessionError.errorDomain && nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
            resolve(["cancelled": true])
            return
          }

          reject("auth_session_failed", nsError.localizedDescription, nsError)
          return
        }

        resolve([
          "cancelled": false,
          "callbackURL": callbackURL?.absoluteString as Any
        ])
      }

      session.presentationContextProvider = self
      session.prefersEphemeralWebBrowserSession = false
      self.currentSession = session

      if !session.start() {
        self.currentSession = nil
        reject("auth_session_start_failed", "Unable to start iOS auth session", nil)
      }
    }
  }

  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    if let keyWindow = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .flatMap({ $0.windows })
      .first(where: { $0.isKeyWindow }) {
      return keyWindow
    }

    return ASPresentationAnchor()
  }
}
