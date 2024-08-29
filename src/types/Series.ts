import Media from './Media';

export default interface Series extends Media {
  seasons: number;
  name: string;
  episodes?: {
    season_number: number;
    episode_count: number;
  }[];
}