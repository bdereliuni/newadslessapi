import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Player from '@oplayer/core';
import OUI from '@oplayer/ui';
import OHls from '@oplayer/hls';

const API_BASE_IMAGE_URL = 'https://image.tmdb.org/t/p/w500';
const CONSUMET_API_BASE = 'https://consumet-api-1ozb.onrender.com/movies/flixhq';
const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = '9ef876e181780c5fa05b91d3706ab166';

interface Source {
  url: string;
  quality: string;
}

interface Subtitle {
  url: string;
  lang: string;
}

interface MovieData {
  title?: string;
  name?: string;
  backdrop_path?: string;
}

export default function Watch() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const [type, setType] = useState<'movie' | 'series'>('movie');
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [maxEpisodes, setMaxEpisodes] = useState(1);
  const [data, setData] = useState<MovieData | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);

  async function getStreamingData(title: string) {
    try {
      const formattedTitle = title.toLowerCase().replace(/ /g, '-');
      const searchResponse = await fetch(`${CONSUMET_API_BASE}/${formattedTitle}?page=1`);
      const searchData = await searchResponse.json();
      
      const exactMatch = searchData.results.find((result: { title: string }) => result.title === title);
      if (!exactMatch) {
        throw new Error('No exact match found');
      }
      
      const mediaId = exactMatch.id;
      
      const infoResponse = await fetch(`${CONSUMET_API_BASE}/info?id=${mediaId}`);
      const infoData = await infoResponse.json();
      
      let episodeId;
      if (type === 'series') {
        const targetEpisode = infoData.episodes.find((ep: { number: number; season: number }) => ep.number === episode && ep.season === season);
        if (!targetEpisode) {
          throw new Error('Episode not found');
        }
        episodeId = targetEpisode.id;
      } else {
        episodeId = infoData.episodes[0].id;
      }
      
      const serversResponse = await fetch(`${CONSUMET_API_BASE}/servers?episodeId=${episodeId}&mediaId=${mediaId}`);
      const serversData = await serversResponse.json();
      
      const server = serversData[0].name;
      
      const watchResponse = await fetch(`${CONSUMET_API_BASE}/watch?episodeId=${episodeId}&mediaId=${mediaId}&server=${server}`);
      const watchData = await watchResponse.json();
      
      setSources(watchData.sources);
      setSubtitles(watchData.subtitles);
      
      return watchData.sources[0].url;
    } catch (error) {
      console.error('Error in getStreamingData:', error);
      return null;
    }
  }

  async function getData(_type: 'movie' | 'series') {
    try {
      const endpoint = _type === 'movie' ? `movie/${id}` : `tv/${id}`;
      const response = await fetch(`${TMDB_API_BASE}/${endpoint}?api_key=${TMDB_API_KEY}`);
      const data = await response.json();

      if (!data) {
        throw new Error('Failed to fetch data');
      }

      setData(data);

      if (_type === 'series') {
        const seasonData = data.seasons.find((s: { season_number: number }) => s.season_number === season);
        if (seasonData) {
          const fullSeasonResponse = await fetch(`${TMDB_API_BASE}/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}`);
          const fullSeasonData = await fullSeasonResponse.json();
          if (fullSeasonData && fullSeasonData.episodes) {
            setMaxEpisodes(fullSeasonData.episodes.length);
          } else {
            throw new Error(`Failed to fetch full season data for season ${season}`);
          }
        } else {
          throw new Error(`Season ${season} not found`);
        }
      }

      const streamingUrl = await getStreamingData(data.name || data.title);
      if (streamingUrl) {
        setVideoUrl(streamingUrl);
      } else {
        throw new Error('Failed to get streaming URL');
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  useEffect(() => {
    const s = search.get('s');
    const e = search.get('e');
    console.log(`URL params - s: ${s}, e: ${e}`);
    if (s && e) {
      const seasonNum = parseInt(s);
      const episodeNum = parseInt(e);
      setSeason(seasonNum);
      setEpisode(episodeNum);
      setType('series');
    } else {
      setType('movie');
    }
  }, [id, search]);

  useEffect(() => {
    getData(type);
  }, [id, type, season, episode]);

  useEffect(() => {
    if (videoUrl && playerContainerRef.current) {
      if (player) {
        player.destroy();
      }

      const newPlayer = Player.make(playerContainerRef.current, {
        source: {
          title: getTitle(),
          src: videoUrl,
          poster: data ? `${API_BASE_IMAGE_URL}${data.backdrop_path}` : '',
          type: 'application/x-mpegurl' as const, // Düzeltilmiş kısım
        },
      })
        .use([
          OUI({
            subtitle: {
              source: subtitles.map(subtitle => ({
                name: subtitle.lang,
                src: subtitle.url,
                default: subtitle.lang.toLowerCase() === 'english', // Default olarak İngilizce altyazı seçilebilir
              })),
            },
            theme: { primaryColor: '#42b883' },
            menu: [
              {
                name: 'Quality',
                position: 'bottom',
                children: sources.map(source => ({
                  name: source.quality,
                  value: source.url,
                  default: source.url === videoUrl,
                })),
                onChange({ value }) {
                  newPlayer.changeQuality({ src: value });
                },
              },
              {
                name: 'Subtitles',
                position: 'bottom',
                children: [
                  { name: 'Off', value: 'off' },
                  ...subtitles.map(subtitle => ({
                    name: subtitle.lang,
                    value: subtitle.url,
                  })),
                ],
                onChange({ value }) {
                  if (value === 'off') {
                    newPlayer.setSubtitles([]); // Altyazıyı kaldır
                  } else {
                    newPlayer.setSubtitles([{ src: value, default: true }]);
                  }
                },
              },
            ],
          }),
          OHls(),
        ])
        .create();

      setPlayer(newPlayer);

      return () => {
        if (newPlayer) {
          newPlayer.destroy();
        }
      };
    }
  }, [videoUrl, data, sources, subtitles]);

  function getTitle() {
    let title = data ? ('name' in data ? data.name : 'title' in data ? data.title : 'Watch') : 'Watch';
    if (type === 'series') title += ` S${season} E${episode}`;
    return title;
  }

  return (
    <>
      <Helmet>
        <title>
          {getTitle()} - {import.meta.env.VITE_APP_NAME}
        </title>
      </Helmet>

      <div className="player">
        <div className="player-controls">
          {type === 'series' && episode < maxEpisodes && (
            <i
              className="fa-regular fa-forward-step right"
              onClick={() => nav(`/watch/${id}?s=${season}&e=${episode + 1}`)}
            ></i>
          )}
        </div>

        <div id="oplayer" ref={playerContainerRef} style={{ width: '100%', height: '100%' }}></div>
      </div>
    </>
  );
}
