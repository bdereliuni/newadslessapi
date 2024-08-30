<?php
//Created by Tommy0412
//https://github.com/Tommy0412
//example usage for tv show: opensubtitles_org.php?imdb=&season=1&episode=1&lang=eng
//example usage for movie: opensubtitles_org.php?imdb=&lang=eng

//ini_set('display_errors', 1);
//ini_set('display_startup_errors', 1);
//error_reporting(E_ALL);
set_time_limit(0);

class SubtitleFetcher {
    public $resultCount;

    public function getResult($imdbid, $season, $episode, $lang) {
        if ($season && $episode) {
            $url = "https://rest.opensubtitles.org/search/episode-$episode/imdbid-$imdbid/season-$season/sublanguageid-$lang";
            //echo $url; 
        } else {
            $url = "https://rest.opensubtitles.org/search/imdbid-$imdbid/sublanguageid-$lang";
            //echo $url; 
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        curl_setopt($ch, CURLOPT_HTTPHEADER, array('x-user-agent: trailers.to-UA'));

        $result = curl_exec($ch);
        curl_close($ch);

        $result = json_decode($result, true);
        $this->resultCount = count($result);

        return $result;
    }
}

$fetcher = new SubtitleFetcher();
$imdb = isset($_GET['imdb']) ? $_GET['imdb'] : null;
$imdbid=str_replace("tt","",$imdb);
$season = isset($_GET['season']) ? $_GET['season'] : null;
$episode = isset($_GET['episode']) ? $_GET['episode'] : null;
$lang = isset($_GET['lang']) ? $_GET['lang'] : null;

if (!$imdb) {
	header('Content-Type: application/json');
    echo json_encode(['error' => 'IMDb ID is required.']);
    exit;
}

$resultArray = $fetcher->getResult($imdbid, $season, $episode, $lang);
$jsonResponse = json_encode($resultArray);

header('Content-Type: application/json');
echo $jsonResponse;
?>