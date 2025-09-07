// backend.js - YouTube Lens Vercel 서버리스 함수

// 기본 export 함수 (Vercel 서버리스 함수 진입점)
export default async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const { action } = req.method === 'GET' ? req.query : req.body;
        
        switch (action) {
            case 'search':
                return await handleSearch(req, res);
            case 'analyze':
                return await handleAnalyze(req, res);
            case 'filter':
                return await handleFilter(req, res);
            case 'sort':
                return await handleSort(req, res);
            default:
                res.status(400).json({ 
                    success: false, 
                    message: '잘못된 action 파라미터입니다.' 
                });
        }
    } catch (error) {
        console.error('API 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || '서버 오류가 발생했습니다.' 
        });
    }
}

// 검색 처리 함수
async function handleSearch(req, res) {
    const searchParams = req.method === 'GET' ? req.query : req.body;
    const { keyword, maxResults, timeFrame, regionCode, apiKeys } = searchParams;
    
    if (!apiKeys || apiKeys.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'API 키가 필요합니다.'
        });
    }
    
    try {
        const results = await searchYouTubeVideos({
            keyword,
            maxResults: parseInt(maxResults) || 50,
            timeFrame,
            regionCode: regionCode || 'KR',
            sortBy: 'relevance',
            videoLicense: 'any'
        }, apiKeys);
        
        res.status(200).json({
            success: true,
            data: results,
            message: `검색 완료 - ${results.length}개 결과`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}

// URL 분석 처리 함수
async function handleAnalyze(req, res) {
    const { url, apiKeys } = req.method === 'GET' ? req.query : req.body;
    
    if (!apiKeys || apiKeys.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'API 키가 필요합니다.'
        });
    }
    
    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('올바른 YouTube URL을 입력해주세요.');
        }
        
        const result = await fetchSingleVideoData(videoId, apiKeys);
        if (!result) {
            throw new Error('비디오 정보를 찾을 수 없습니다.');
        }
        
        res.status(200).json({
            success: true,
            data: [result],
            message: 'URL 분석 완료'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}

// 필터 처리 함수
async function handleFilter(req, res) {
    const { results, filters } = req.method === 'GET' ? req.query : req.body;
    
    try {
        const filteredResults = applyFilters(results, filters);
        
        res.status(200).json({
            success: true,
            data: filteredResults,
            message: `필터 적용 완료 - 원본 ${results.length}개 → 필터 후 ${filteredResults.length}개 결과`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: results
        });
    }
}

// 정렬 처리 함수
async function handleSort(req, res) {
    const { results, column, order } = req.method === 'GET' ? req.query : req.body;
    
    try {
        const sortedResults = sortTable(parseInt(column), order, results);
        
        res.status(200).json({
            success: true,
            data: sortedResults,
            message: '정렬 완료'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: results
        });
    }
}

// YouTube 검색 메인 함수
async function searchYouTubeVideos(searchParams, apiKeys) {
    const { keyword, maxResults, timeFrame, regionCode, sortBy, videoLicense } = searchParams;
    
    let currentApiIndex = 0;
    
    // 현재 사용 중인 API 키 반환
    function getCurrentApiKey() {
        if (apiKeys.length === 0) return null;
        if (currentApiIndex >= apiKeys.length) currentApiIndex = 0;
        return apiKeys[currentApiIndex];
    }
    
    // 다음 API 키로 로테이션
    function rotateToNextApiKey() {
        if (apiKeys.length <= 1) return false;
        currentApiIndex = (currentApiIndex + 1) % apiKeys.length;
        console.log(`API 키 로테이션: 인덱스 ${currentApiIndex}로 전환`);
        return true;
    }
    
    // API 요청 함수 (로테이션 지원)
    async function makeApiRequest(url, maxRetries = apiKeys.length) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const currentKey = getCurrentApiKey();
            if (!currentKey) {
                throw new Error('사용 가능한 API 키가 없습니다.');
            }
            
            const requestUrl = url.replace('APIKEY_PLACEHOLDER', currentKey);
            
            try {
                const response = await fetch(requestUrl);
                const data = await response.json();
                
                if (response.ok) {
                    return { response, data };
                } else if (response.status === 403 || response.status === 429) {
                    console.log(`API 키 오류 (${response.status}): 다음 키로 전환`);
                    if (!rotateToNextApiKey()) {
                        throw new Error('모든 API 키가 만료되었습니다. 새로운 API 키를 추가해주세요.');
                    }
                    continue;
                } else {
                    throw new Error(data.error?.message || '검색 요청이 실패했습니다.');
                }
            } catch (fetchError) {
                if (attempt === maxRetries - 1) {
                    throw fetchError;
                }
                console.log(`네트워크 오류, 다음 키로 시도: ${fetchError.message}`);
                rotateToNextApiKey();
            }
        }
    }

    let publishedAfter = '';
    let publishedBefore = '';
    
    // 기간 설정 로직
    if (timeFrame === 'custom') {
        // 날짜 직접 선택 로직 (프론트엔드에서 처리)
        const startDate = searchParams.startDate;
        const endDate = searchParams.endDate;
        
        if (!startDate || !endDate) {
            throw new Error('시작일과 종료일을 모두 입력해주세요.');
        }
        
        publishedAfter = new Date(startDate + 'T00:00:00+09:00').toISOString();
        publishedBefore = new Date(endDate + 'T23:59:59+09:00').toISOString();
        
    } else if (timeFrame) {
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        
        switch(timeFrame) {
            case 'hour':
                publishedAfter = new Date(koreaTime.getTime() - 60*60*1000).toISOString();
                break;
            case 'day':
                publishedAfter = new Date(koreaTime.getTime() - 24*60*60*1000).toISOString();
                break;
            case 'week':
                publishedAfter = new Date(koreaTime.getTime() - 7*24*60*60*1000).toISOString();
                break;
            case 'month':
                publishedAfter = new Date(koreaTime.getTime() - 30*24*60*60*1000).toISOString();
                break;
            case '3months':
                publishedAfter = new Date(koreaTime.getTime() - 90*24*60*60*1000).toISOString();
                break;
            case '6months':
                publishedAfter = new Date(koreaTime.getTime() - 180*24*60*60*1000).toISOString();
                break;
            case 'year':
                publishedAfter = new Date(koreaTime.getTime() - 365*24*60*60*1000).toISOString();
                break;
        }
    }

    // YouTube Data API v3 검색
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `key=APIKEY_PLACEHOLDER&` +
        `part=snippet&` +
        `type=video&` +
        `maxResults=${maxResults}&` +
        `order=${sortBy}&` +
        `regionCode=${regionCode}`;
    
    // 국가별 언어 코드 매핑
    const languageMapping = {
        "KR": "ko", "JP": "ja", "US": "en", "TW": "zh-TW", "GB": "en",
        "CA": "en", "AU": "en", "DE": "de", "FR": "fr", "ES": "es",
        "BR": "pt", "IN": "hi", "RU": "ru"
    };
    
    if (regionCode in languageMapping) {
        searchUrl += `&relevanceLanguage=${languageMapping[regionCode]}`;
    }
    
    if (keyword) {
        searchUrl += `&q=${encodeURIComponent(keyword)}`;
    } else {
        searchUrl += `&q=*`;
    }

    if (publishedAfter) {
        searchUrl += `&publishedAfter=${publishedAfter}`;
    }
    if (publishedBefore) {
        searchUrl += `&publishedBefore=${publishedBefore}`;
    }
    if (videoLicense) {
        searchUrl += `&videoLicense=${videoLicense}`;
    }

    const { response: searchResponse, data: searchData } = await makeApiRequest(searchUrl);

    if (!searchData.items || searchData.items.length === 0) {
        return [];
    }

    // 비디오 상세 정보 가져오기
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `key=APIKEY_PLACEHOLDER&` +
        `id=${videoIds}&` +
        `part=snippet,statistics,contentDetails`;

    const { response: videosResponse, data: videosData } = await makeApiRequest(videosUrl);

    // 채널 정보 가져오기
    const channelIds = [...new Set(videosData.items.map(item => item.snippet.channelId))].join(',');
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
        `key=APIKEY_PLACEHOLDER&` +
        `id=${channelIds}&` +
        `part=snippet,statistics`;

    const { response: channelsResponse, data: channelsData } = await makeApiRequest(channelsUrl);

    // 결과 조합 및 CII 계산
    let results = videosData.items.map((video, index) => {
        const channel = channelsData.items.find(ch => ch.id === video.snippet.channelId);
        const subscriberCount = parseInt(channel?.statistics?.subscriberCount || 0);
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        const likeCount = parseInt(video.statistics?.likeCount || 0);
        const commentCount = parseInt(video.statistics?.commentCount || 0);

        // CII 점수 계산 (올바른 공식 사용)
        const channelTotalViewCount = parseInt(channel?.statistics?.viewCount || 0);
        const contributionValue = channelTotalViewCount > 0 ? (viewCount / channelTotalViewCount) * 100 : 0;
        const performanceValue = subscriberCount > 0 ? viewCount / subscriberCount : 0;
        const ciiScore = (contributionValue * 0.7) + (performanceValue * 30);

        let cii = 'Bad';
        if (ciiScore >= 70) cii = 'Great!!';
        else if (ciiScore >= 50) cii = 'Good';
        else if (ciiScore >= 30) cii = 'Soso';
        else if (ciiScore >= 10) cii = 'Not bad';
        
        // 쇼츠 여부 판단
        const durationParts = video.contentDetails.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        let totalSeconds = 0;
        if (durationParts) {
            const hours = durationParts[1] ? parseInt(durationParts[1].replace('H', '')) : 0;
            const minutes = durationParts[2] ? parseInt(durationParts[2].replace('M', '')) : 0;
            const seconds = durationParts[3] ? parseInt(durationParts[3].replace('S', '')) : 0;
            totalSeconds = hours * 3600 + minutes * 60 + seconds;
        }
        const isShorts = totalSeconds <= 60;

        return {
            index: index + 1,
            thumbnail: video.snippet.thumbnails?.default?.url || '',
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            duration: formatDuration(video.contentDetails.duration),
            publishedAt: formatDate(video.snippet.publishedAt),
            publishedAtRaw: video.snippet.publishedAt,
            subscriberCount: subscriberCount,
            viewCount: viewCount,
            contributionValue: parseFloat(contributionValue.toFixed(2)),
            performanceValue: parseFloat(performanceValue.toFixed(2)),
            cii: cii,
            ciiScore: parseFloat(ciiScore.toFixed(1)),
            commentCount: commentCount,
            likeCount: likeCount,
            totalVideos: parseInt(channel?.statistics?.videoCount || 0),
            videoId: video.id,
            license: video.status?.license || 'youtube',
            isShorts: isShorts,
            engagementRate: viewCount > 0 ? parseFloat(((likeCount + commentCount) / viewCount * 100).toFixed(1)) : 0,
            description: video.snippet.description || ''
        };
    });

    // 정렬 처리 (조회수순 기본)
    results = results.sort((a, b) => b.viewCount - a.viewCount);
    
    // 인덱스 재조정
    results = results.map((item, index) => ({
        ...item,
        index: index + 1
    }));

    return results;
}

// 단일 비디오 데이터 가져오기
async function fetchSingleVideoData(videoId, apiKeys) {
    let currentApiIndex = 0;
    
    function getCurrentApiKey() {
        if (apiKeys.length === 0) return null;
        if (currentApiIndex >= apiKeys.length) currentApiIndex = 0;
        return apiKeys[currentApiIndex];
    }
    
    function rotateToNextApiKey() {
        if (apiKeys.length <= 1) return false;
        currentApiIndex = (currentApiIndex + 1) % apiKeys.length;
        return true;
    }

    async function makeApiRequest(url, maxRetries = apiKeys.length) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const currentKey = getCurrentApiKey();
            if (!currentKey) {
                throw new Error('사용 가능한 API 키가 없습니다.');
            }
            
            const requestUrl = url.replace('APIKEY_PLACEHOLDER', currentKey);
            
            try {
                const response = await fetch(requestUrl);
                const data = await response.json();
                
                if (response.ok) {
                    return { response, data };
                } else if (response.status === 403 || response.status === 429) {
                    console.log(`API 키 오류 (${response.status}): 다음 키로 전환`);
                    if (!rotateToNextApiKey()) {
                        throw new Error('모든 API 키가 만료되었습니다.');
                    }
                    continue;
                } else {
                    throw new Error(data.error?.message || '비디오 정보 요청이 실패했습니다.');
                }
            } catch (fetchError) {
                if (attempt === maxRetries - 1) {
                    throw fetchError;
                }
                console.log(`네트워크 오류, 다음 키로 시도: ${fetchError.message}`);
                rotateToNextApiKey();
            }
        }
    }
    
    try {
        // 비디오 상세 정보 가져오기
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `key=APIKEY_PLACEHOLDER&` +
            `id=${videoId}&` +
            `part=snippet,statistics,contentDetails`;
        
        const { response: videosResponse, data: videosData } = await makeApiRequest(videosUrl);
        
        if (!videosData.items || videosData.items.length === 0) {
            return null;
        }
        
        const video = videosData.items[0];
        
        // 채널 정보 가져오기
        const channelId = video.snippet.channelId;
        const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
            `key=APIKEY_PLACEHOLDER&` +
            `id=${channelId}&` +
            `part=snippet,statistics`;
        
        const { response: channelsResponse, data: channelsData } = await makeApiRequest(channelsUrl);
        
        if (!channelsData.items || channelsData.items.length === 0) {
            return null;
        }
        
        const channel = channelsData.items[0];
        
        // 데이터 조합 및 계산
        const subscriberCount = parseInt(channel.statistics?.subscriberCount || 0);
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        const likeCount = parseInt(video.statistics?.likeCount || 0);
        const commentCount = parseInt(video.statistics?.commentCount || 0);
        
        // CII 점수 계산
        const channelTotalViewCount = parseInt(channel.statistics?.viewCount || 0);
        const contributionValue = channelTotalViewCount > 0 ? (viewCount / channelTotalViewCount) * 100 : 0;
        const performanceValue = subscriberCount > 0 ? viewCount / subscriberCount : 0;
        const ciiScore = (contributionValue * 0.7) + (performanceValue * 30);
        
        let cii = 'Bad';
        if (ciiScore >= 70) cii = 'Great!!';
        else if (ciiScore >= 50) cii = 'Good';
        else if (ciiScore >= 30) cii = 'Soso';
        else if (ciiScore >= 10) cii = 'Not bad';
        
        // 쇼츠 여부 판단
        const durationParts = video.contentDetails.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        let totalSeconds = 0;
        if (durationParts) {
            const hours = durationParts[1] ? parseInt(durationParts[1].replace('H', '')) : 0;
            const minutes = durationParts[2] ? parseInt(durationParts[2].replace('M', '')) : 0;
            const seconds = durationParts[3] ? parseInt(durationParts[3].replace('S', '')) : 0;
            totalSeconds = hours * 3600 + minutes * 60 + seconds;
        }
        const isShorts = totalSeconds <= 60;
        
        // 결과 객체 생성
        return {
            index: 1,
            thumbnail: video.snippet.thumbnails?.default?.url || '',
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            duration: formatDuration(video.contentDetails.duration),
            publishedAt: formatDate(video.snippet.publishedAt),
            publishedAtRaw: video.snippet.publishedAt,
            subscriberCount: subscriberCount,
            viewCount: viewCount,
            contributionValue: parseFloat(contributionValue.toFixed(2)),
            performanceValue: parseFloat(performanceValue.toFixed(2)),
            cii: cii,
            ciiScore: parseFloat(ciiScore.toFixed(1)),
            commentCount: commentCount,
            likeCount: likeCount,
            totalVideos: parseInt(channel.statistics?.videoCount || 0),
            videoId: video.id,
            license: video.status?.license || 'youtube',
            isShorts: isShorts,
            engagementRate: viewCount > 0 ? parseFloat(((likeCount + commentCount) / viewCount * 100).toFixed(1)) : 0,
            description: video.snippet.description || ''
        };
        
    } catch (error) {
        console.error('단일 비디오 데이터 가져오기 오류:', error);
        throw error;
    }
}

// 필터 적용 함수
function applyFilters(results, filters) {
    let filteredResults = [];
    
    for (let result of results) {
        let shouldInclude = true;
        
        // 비디오 타입 필터 (쇼츠/롱폼)
        if (filters.shorts || filters.longform) {
            const isShorts = result.isShorts || false;
            
            if (filters.shorts && !filters.longform) {
                if (!isShorts) shouldInclude = false;
            } else if (filters.longform && !filters.shorts) {
                if (isShorts) shouldInclude = false;
            }
        }
        
        // CII 필터
        if (filters.ciiGreat || filters.ciiGood || filters.ciiSoso) {
            const cii = result.cii;
            if (!((filters.ciiGreat && cii === 'Great!!') ||
                  (filters.ciiGood && cii === 'Good') ||
                  (filters.ciiSoso && cii === 'Soso'))) {
                shouldInclude = false;
            }
        }
        
        // 조회수 필터
        if (filters.viewCount) {
            const minViews = parseInt(filters.viewCount);
            if (result.viewCount < minViews) {
                shouldInclude = false;
            }
        }
        
        // 구독자수 필터 (이하 조건)
        if (filters.subscriberCount) {
            const maxSubscribers = parseInt(filters.subscriberCount);
            if (result.subscriberCount > maxSubscribers) {
                shouldInclude = false;
            }
        }
        
        if (shouldInclude) {
            filteredResults.push(result);
        }
    }
    
    return filteredResults;
}

// 테이블 정렬 함수
function sortTable(column, order, results) {
    if (order === 'reset') {
        return results.slice();
    }
    
    const sortedResults = [...results].sort((a, b) => {
        let valueA, valueB;
        
        switch(column) {
            case 2: // 채널명
                valueA = a.channelTitle;
                valueB = b.channelTitle;
                break;
            case 3: // 제목
                valueA = a.title;
                valueB = b.title;
                break;
            case 4: // 게시일
                valueA = new Date(a.publishedAtRaw);
                valueB = new Date(b.publishedAtRaw);
                break;
            case 5: // 구독자 수
                valueA = a.subscriberCount;
                valueB = b.subscriberCount;
                break;
            case 6: // 조회수
                valueA = a.viewCount;
                valueB = b.viewCount;
                break;
            case 7: // 채널 기여도
                valueA = a.contributionValue;
                valueB = b.contributionValue;
                break;
            case 8: // 성과도 배율
                valueA = a.performanceValue;
                valueB = b.performanceValue;
                break;
            case 9: // CII
                valueA = a.ciiScore;
                valueB = b.ciiScore;
                break;
            case 10: // 영상길이
                valueA = durationToSeconds(a.duration);
                valueB = durationToSeconds(b.duration);
                break;
            case 11: // 좋아요 수
                valueA = a.likeCount;
                valueB = b.likeCount;
                break;
            case 12: // 댓글 수
                valueA = a.commentCount;
                valueB = b.commentCount;
                break;
            case 13: // 참여율
                valueA = a.engagementRate;
                valueB = b.engagementRate;
                break;
            case 14: // 총 영상 수
                valueA = a.totalVideos;
                valueB = b.totalVideos;
                break;
            default:
                return 0;
        }
        
        if (typeof valueA === 'string' && typeof valueB === 'string') {
            return order === 'asc' ? 
                valueA.localeCompare(valueB) : 
                valueB.localeCompare(valueA);
        } else {
            if (order === 'asc') {
                return valueA - valueB;
            } else {
                return valueB - valueA;
            }
        }
    });
    
    return sortedResults.map((item, index) => ({
        ...item,
        index: index + 1
    }));
}

// 유틸리티 함수들
function formatDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');
    
    if (hours) {
        return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    } else {
        return `${minutes || '0'}:${seconds.padStart(2, '0')}`;
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {timeZone: 'Asia/Seoul'}) + ' ' + 
           date.toLocaleTimeString('ko-KR', {timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit'});
}

function durationToSeconds(duration) {
    if (!duration || duration === '') return 0;
    
    const parts = duration.split(':').map(num => parseInt(num));
    
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
        return 0;
    }
}

// YouTube URL에서 비디오 ID 추출
function extractVideoId(url) {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}
