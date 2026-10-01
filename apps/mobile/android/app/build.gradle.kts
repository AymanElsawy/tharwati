import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// This file is local and ignored. Passwords may instead come from protected CI env vars.
val releaseSigningProperties = Properties()
val releaseSigningFile = rootProject.file("key.properties")
var releaseSigningLoadFailed = false
if (releaseSigningFile.isFile) {
    try {
        releaseSigningFile.inputStream().use { releaseSigningProperties.load(it) }
    } catch (_: Exception) {
        releaseSigningLoadFailed = true
    }
}
fun signingValue(property: String, environment: String): String? =
    System.getenv(environment)?.takeIf { it.isNotBlank() }
        ?: releaseSigningProperties.getProperty(property)?.takeIf { it.isNotBlank() }

val uploadStorePath = signingValue("storeFile", "THARWATI_UPLOAD_STORE_FILE")
val uploadStorePassword = signingValue("storePassword", "THARWATI_UPLOAD_STORE_PASSWORD")
val uploadKeyAlias = signingValue("keyAlias", "THARWATI_UPLOAD_KEY_ALIAS")
val uploadKeyPassword = signingValue("keyPassword", "THARWATI_UPLOAD_KEY_PASSWORD")
val uploadStoreFile = uploadStorePath?.let { rootProject.file(it) }

fun requireReleaseSigning() {
    if (releaseSigningLoadFailed || uploadStoreFile?.isFile != true ||
        uploadStorePassword == null || uploadKeyAlias == null || uploadKeyPassword == null) {
        throw GradleException(
            "Production release signing is required: configure android/key.properties " +
                "or THARWATI_UPLOAD_* protected environment variables with an existing upload " +
                "keystore and all four signing values. See docs/mobile.md. No debug fallback."
        )
    }
}

android {
    namespace = "com.tharwati.tharwati_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.tharwati.tharwati_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            storeFile = uploadStoreFile
            storePassword = uploadStorePassword
            keyAlias = uploadKeyAlias
            keyPassword = uploadKeyPassword
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

// Inspect the resolved graph, including abbreviated and aggregate task requests.
// Fail before any release tasks run; missing signing must not break debug/emulator builds.
if (gradle.startParameter.isConfigurationCacheRequested) {
    throw GradleException("Configuration cache is unsupported by the release signing guard; use --no-configuration-cache.")
}
gradle.taskGraph.whenReady {
    if (allTasks.any { it.project == project && it.name.contains("Release", ignoreCase = true) }) {
        requireReleaseSigning()
    }
}

tasks.register("verifySigningArchitecture") {
    group = "verification"
    description = "Verify debug/release signing separation without requiring upload credentials."
    doLast {
        check(android.buildTypes.getByName("debug").signingConfig?.name == "debug")
        check(android.buildTypes.getByName("release").signingConfig?.name == "release")
        check(android.signingConfigs.getByName("release") !== android.signingConfigs.getByName("debug"))
        println("Debug uses debug signing; release uses a separate release signing configuration.")
    }
}

flutter {
    source = "../.."
}
