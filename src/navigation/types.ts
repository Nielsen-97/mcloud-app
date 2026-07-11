import type { Album } from '../types';

export type AlbumStackParamList = {
  AlbumList: undefined;
  AlbumDetail: { album: Album };
};

export type RootTabParamList = {
  Billeder: undefined;
  Videoer: undefined;
  Dokumenter: undefined;
  Albums: undefined;
  Indstillinger: undefined;
};
