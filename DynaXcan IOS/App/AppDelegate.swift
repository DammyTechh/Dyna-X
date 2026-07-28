import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    private(set) var launchMaintenanceError: Error?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        do {
            try RawPointCloudStore().pruneExpired()
        } catch {
            launchMaintenanceError = error
            NSLog("DynaXcan raw scan retention maintenance failed: %@", error.localizedDescription)
        }
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        UISceneConfiguration(
            name: "Default Configuration",
            sessionRole: connectingSceneSession.role
        )
    }
}
