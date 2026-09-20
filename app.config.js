const IS_PARTNER = process.env.APP_VARIANT === 'partner';

module.exports = {
  expo: {
    name: IS_PARTNER ? "FixGo Partner" : "FixGo",
    slug: "FixGo",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: IS_PARTNER ? "fixgopartner" : "fixgo",
    userInterfaceStyle: "automatic",
    ios: {
      icon: "./assets/expo.icon"
    },
    android: {
      package: IS_PARTNER ? "com.fixgo.partner" : "com.fixgo.customer",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#123A40",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 76
        }
      ],
      "expo-secure-store",
      "expo-sqlite",
      "@react-native-community/datetimepicker",
      "expo-image",
      "expo-web-browser"
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "27de5f59-0df0-4314-9136-b6432e42bd8f",
      },
    }
  }
};
