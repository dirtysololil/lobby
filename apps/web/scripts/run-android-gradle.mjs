import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const task = process.argv[2];

if (!task) {
  console.error("[android/gradle] Missing Gradle task. Example: bundleRelease");
  process.exit(1);
}

const webRoot = path.resolve(import.meta.dirname, "..");
const androidRoot = path.join(webRoot, "android");
const gradleWrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradleCommand = path.join(androidRoot, gradleWrapper);

function findFirstExisting(candidates) {
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function resolveAndroidSdkPath() {
  const homeDirectory = os.homedir();
  const localAppData = process.env.LOCALAPPDATA;

  return findFirstExisting([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    localAppData ? path.join(localAppData, "Android", "Sdk") : null,
    path.join(homeDirectory, "AppData", "Local", "Android", "Sdk"),
    path.join(homeDirectory, "Library", "Android", "sdk"),
    path.join(homeDirectory, "Android", "Sdk"),
  ]);
}

function resolveJavaHome() {
  return findFirstExisting([
    process.env.JAVA_HOME,
    "C:\\Program Files\\Android\\openjdk\\jdk-21.0.8",
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    "/opt/android-studio/jbr",
  ]);
}

const androidSdkPath = resolveAndroidSdkPath();

if (!androidSdkPath) {
  console.error(
    "[android/gradle] Android SDK not found. Set ANDROID_HOME or install Android SDK.",
  );
  process.exit(1);
}

const javaHome = resolveJavaHome();

if (!javaHome) {
  console.error(
    "[android/gradle] Java runtime not found. Set JAVA_HOME to JDK 17+.",
  );
  process.exit(1);
}

console.info("[android/gradle] using", {
  task,
  javaHome,
  androidSdkPath,
});

const result = spawnSync(gradleCommand, [task], {
  cwd: androidRoot,
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdkPath,
    ANDROID_SDK_ROOT: androidSdkPath,
    Path:
      process.platform === "win32"
        ? `${path.join(javaHome, "bin")};${process.env.Path ?? ""}`
        : `${path.join(javaHome, "bin")}:${process.env.PATH ?? ""}`,
  },
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("[android/gradle] failed to run Gradle", result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
