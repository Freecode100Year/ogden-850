import java.util.Properties

plugins {
    id("com.android.application")
}

// Release signing: android/keystore.properties (not in git) with
// storeFile, storePassword, keyAlias, keyPassword. Keep the same key for every
// release, otherwise phones refuse to update the installed app.
val signing = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "net.freedom8964.ogden850"
    compileSdk = 36

    defaultConfig {
        applicationId = "net.freedom8964.ogden850"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (signing.containsKey("storeFile")) {
            create("release") {
                storeFile = file(signing.getProperty("storeFile"))
                storePassword = signing.getProperty("storePassword")
                keyAlias = signing.getProperty("keyAlias")
                keyPassword = signing.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        // already compressed; storing them uncompressed lets the WebView read them directly
        noCompress += listOf("ogg", "woff2")
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
}
