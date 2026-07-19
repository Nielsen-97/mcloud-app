# MCloudApp

iOS-klient (React Native 0.86, TypeScript) til [MCloud](https://mcloud.taile49ac8.ts.net) — en selvhostet cloud-løsning på en Raspberry Pi 4. Distribueres via AltStore, ikke App Store.

## Kom i gang

```sh
npm install
npm start
```

### iOS

```sh
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

### Typecheck / lint / tests

```sh
npx tsc --noEmit
npx eslint src App.tsx --ext .ts,.tsx
npx jest
```

### Bygge en .ipa til sideloading (uden Mac)

`codemagic.yaml` bygger appen på Codemagic's Mac-runners for et rigtigt device
(`-sdk iphoneos`) uden code signing, pakker `.app` i en `Payload/`-mappe og zipper
den til `build/MCloudApp.ipa`. Denne IPA er **usigneret** — det er meningen.
Sideloadly (eller AltServer) signerer den selv med dit Apple ID, når du installerer.

Bemærk forskellen på de to sideloading-værktøjer:

- **Sideloadly**: manuel, engangs-installation fra din computer. Praktisk til at
  teste builds hurtigt, men appen udløber efter 7 dage (gratis Apple ID) uden at
  blive fornyet automatisk.
- **AltStore + AltServer** (det oprindelige mål — se projektbeskrivelsen): AltServer
  kører på Raspberry Pi'en og forny­er appen automatisk hver 7. dag, når telefonen er
  på hjemme-WiFi. Det er det du vil bruge i det lange løb, ikke Sideloadly.

Samme `.ipa` virker til begge — installer via Sideloadly til hurtig test, og via
AltStore når du vil have den til at blive ved med at virke uden manuel indgriben.

## Struktur

```
App.tsx                 Login-skærm + bottom-tab navigation
src/
  api/client.ts         Alle server-kald (SERVER_URL = https://mcloud.taile49ac8.ts.net)
  config.ts             Server-URL, farvetema, AsyncStorage-nøgler
  context/               Auth- og sync-state (React context)
  services/
    photoSync.ts         Kernelogik: scanner kamerarullen, uploader kun billeder
                         hvis deres localIdentifier ikke allerede er uploadet
    backgroundSync.ts    react-native-background-fetch + NetInfo WiFi-trigger
    uploadQueue.ts       Genbrugelig kø med retry + eksponentiel backoff
  screens/               Billeder, Videoer, Dokumenter, Albums (+detalje), Indstillinger
  components/            Lightbox, video-afspiller, dato-grupperet grid, upload-banner
```

## Status vs. projektbeskrivelsen

Alle 11 punkter i den prioriterede liste er implementeret. To ting er værd at være
opmærksom på, fordi de rækker ud over hvad den dokumenterede server-API i øjeblikket
understøtter:

1. **Albums – offentligt delelink** (`generateAlbumShareLink` i `src/api/client.ts`)
   antager et endpoint `POST /albums/<id>/share`, som ikke findes i den dokumenterede
   API. Knappen viser en fejlbesked pænt hvis serveren svarer 404, indtil et sådant
   endpoint tilføjes.
2. **Live Photos** detekteres korrekt via `subTypes === 'PhotoLive'`
   (`src/services/photoSync.ts`), og stillbilledet uploades som normalt. At uploade
   selve video-delen kræver adgang til `PHAssetResourceType.pairedVideo`, som
   `@react-native-camera-roll/camera-roll`'s JS-API ikke eksponerer — det kræver et
   lille natively modul (Swift) oven på PhotoKit. Det er ikke bygget her.

Baggrundssynkronisering (højeste prioritet) er fuldt implementeret: hvert billede
identificeres via dets permanente `localIdentifier`, allerede uploadede id'er gemmes
i AsyncStorage, og kun nye billeder uploades — uanset filnavne eller tidspunkter.
