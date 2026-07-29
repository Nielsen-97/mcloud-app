import type { Album, Recipe } from '../types';

export type AlbumStackParamList = {
  AlbumList: undefined;
  AlbumDetail: { album: Album };
};

export type RecipeStackParamList = {
  RecipeList: undefined;
  RecipeWebView: { recipe: Recipe };
};

export type RootTabParamList = {
  Billeder: undefined;
  Videoer: undefined;
  Dokumenter: undefined;
  Albums: undefined;
  Opskrifter: undefined;
  Indstillinger: undefined;
};
