# Remote Mobile Shell

Lobby подготовлен под `Capacitor remote hosted app` без `static export`, без `localhost` и без переписывания UI.

Ключевой режим:

- native shell всегда открывает `https://lobby.holty.ru`
- API идёт через `https://api.lobby.holty.ru`
- realtime использует secure socket transport на `api.lobby.holty.ru`
- после деплоя web-части новые UI-изменения доступны в mobile shell без обновления APK/IPA
- локально в native project не лежит `.next` bundle, только минимальный `apps/web/capacitor-shell`

## Основные команды

Работать из `apps/web`:

```bash
pnpm cap sync android
pnpm cap open android
pnpm cap sync ios
pnpm cap open ios
```

Альтернатива через scripts:

```bash
pnpm android:sync
pnpm android:open
pnpm ios:sync
pnpm ios:open
```

## Android release

```bash
pnpm cap sync android
pnpm android:bundle
pnpm android:apk:release
```

Артефакты:

- `android/app/build/outputs/bundle/release/*.aab`
- `android/app/build/outputs/apk/release/*.apk`

`android:bundle` и `android:apk:release` используют `apps/web/scripts/run-android-gradle.mjs`,
который пытается сам определить `JAVA_HOME` и Android SDK для локальной сборки.

## iOS

```bash
pnpm cap sync ios
pnpm cap open ios
```

Дальше сборка и подпись делаются уже в Xcode.

## Native UX

Подготовлено:

- `StatusBar` dark-theme shell
- `Keyboard` resize mode для messenger composer
- safe-area friendly layout
- reconnect websocket после native resume
- сохранение последнего маршрута и возврат в тот же DM после повторного открытия
- camera/mic permissions для звонков, кружков и upload flow
