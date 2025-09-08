// new.js - test.html의 모든 JavaScript 기능을 서버리스 함수로 직접 변환
// test.html의 JavaScript 코드를 완전히 그대로 포팅하여 누락 없이 구현

// CORS 헤더 설정 함수
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// 메인 핸들러 함수 (Vercel 진입점)
export default async function handler(req, res) {
    setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const { action, currentApiKeyIndex } = req.method === 'GET' ? req.query : req.body;
        let currentApiIndex = parseInt(currentApiKeyIndex) || 0;
        
        switch (action) {
            case 'search':
                return await handleSearch(req, res);
            case 'analyze':
                return await handleAnalyze(req, res);
            case 'filter':
                return await handleFilter(req, res);
            case 'translate':
                return await handleTranslate(req, res);
            case 'channelInfo':
                return await handleChannelInfo(req, res);
            case 'channelVideos':
                return await handleChannelVideos(req, res);
            case 'channelSearch':
                return await handleChannelSearch(req, res);
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

// 검색 처리 함수 (test.html의 searchYouTubeVideos 함수 완전 포팅)
async function handleSearch(req, res) {
    const data = req.method === 'GET' ? req.query : req.body;
    const { 
        keyword, 
        maxResults, 
        timeFrame, 
        regionCode, 
        apiKeys, 
        isViewsSort, 
        isAllVideos, 
        isVideoSearch,
        startDate, 
        endDate,
        currentApiKeyIndex
    } = data;
    
    console.log('🔍 검색 요청:', { keyword, maxResults, timeFrame, regionCode, isViewsSort });
    
    if (!apiKeys || apiKeys.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'API 키가 필요합니다.'
        });
    }
    
    try {
        const results = await searchYouTubeVideos({
            keyword: keyword?.trim() || '',
            maxResults: parseInt(maxResults) || 50,
            timeFrame,
            regionCode: regionCode || 'KR',
            isViewsSort: isViewsSort === true || isViewsSort === 'true',
            isAllVideos: isAllVideos === true || isAllVideos === 'true', 
            isVideoSearch: isVideoSearch === true || isVideoSearch === 'true',
            startDate,
            endDate,
            currentApiKeyIndex: parseInt(currentApiKeyIndex) || 0
        }, apiKeys);
        
        res.status(200).json({
            success: true,
            data: results,
            message: `검색 완료 - ${results.length}개 결과`,
            currentApiKeyIndex: results.currentApiKeyIndex || 0
        });
    } catch (error) {
        console.error('검색 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}


// URL 분석 처리 함수 (test.html의 analyzeYouTubeUrl + fetchSingleVideoData 완전 포팅)
async function handleAnalyze(req, res) {
    const { url, apiKeys, currentApiKeyIndex } = req.method === 'GET' ? req.query : req.body;
    
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
        
        const result = await fetchSingleVideoData(videoId, apiKeys, parseInt(currentApiKeyIndex) || 0);
        if (!result) {
            throw new Error('비디오 정보를 찾을 수 없습니다.');
        }
        
        res.status(200).json({
            success: true,
            data: [result.data],
            message: 'URL 분석 완료',
            currentApiKeyIndex: result.currentApiKeyIndex || 0
        });
    } catch (error) {
        console.error('URL 분석 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}


// 필터 처리 함수 (test.html의 applyFilters 완전 포팅)
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
        console.error('필터 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: results
        });
    }
}

// 번역 처리 함수 (test.html의 translateSearchTerm + deeplTranslate + googleTranslate 완전 포팅)
async function handleTranslate(req, res) {
    const { searchTerm, regionCode } = req.method === 'GET' ? req.query : req.body;
    
    try {
        const translatedText = await translateSearchTerm(regionCode, searchTerm);
        
        res.status(200).json({
            success: true,
            data: { translatedText },
            message: translatedText ? '번역 완료' : '번역 불필요'
        });
    } catch (error) {
        console.error('번역 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: { translatedText: searchTerm }
        });
    }
}

// 채널 정보 처리 함수 (test.html의 fetchDetailedChannelInfo 완전 포팅)
async function handleChannelInfo(req, res) {
    const { channelId, apiKeys, currentApiKeyIndex } = req.method === 'GET' ? req.query : req.body;
    
    if (!apiKeys || apiKeys.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'API 키가 필요합니다.'
        });
    }
    
    try {
        const result = await fetchDetailedChannelInfo(channelId, apiKeys, parseInt(currentApiKeyIndex) || 0);
        
        res.status(200).json({
            success: true,
            data: result.data,
            message: '채널 정보 가져오기 완료',
            currentApiKeyIndex: result.currentApiKeyIndex || 0
        });
    } catch (error) {
        console.error('채널 정보 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
}


// 채널 영상 수집 처리 함수 (test.html의 fetchChannelVideos 완전 포팅)
async function handleChannelVideos(req, res) {
    const { channelId, uploadPlaylist, maxResults, apiKeys, currentApiKeyIndex } = req.method === 'GET' ? req.query : req.body;
    
    if (!apiKeys || apiKeys.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'API 키가 필요합니다.'
        });
    }
    
    try {
        const result = await fetchChannelVideos(channelId, uploadPlaylist, parseInt(maxResults) || 50, apiKeys, parseInt(currentApiKeyIndex) || 0);
        
        res.status(200).json({
            success: true,
            data: result.data,
            message: `채널 영상 수집 완료 - ${result.data.length}개 결과`,
            currentApiKeyIndex: result.currentApiKeyIndex || 0
        });
    } catch (error) {
        console.error('채널 영상 수집 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}


// 채널 검색 처리 함수 (test.html의 searchChannelByName 완전 포팅)
async function handleChannelSearch(req, res) {
    const { channelName, regionCode, apiKeys, currentApiKeyIndex } = req.method === 'GET' ? req.query : req.body;
    
    console.log('🔍 채널 검색 요청 받음:', { channelName, regionCode, apiKeysCount: apiKeys?.length });
    
    if (!apiKeys || apiKeys.length === 0) {
        console.log('❌ API 키 없음');
        return res.status(400).json({
            success: false,
            message: 'API 키가 필요합니다.'
        });
    }
    
    try {
        console.log('🚀 searchChannelByName 호출 시작');
        const result = await searchChannelByName(channelName, regionCode || 'KR', apiKeys, parseInt(currentApiKeyIndex) || 0);
        console.log('✅ searchChannelByName 완료:', result);
        
        res.status(200).json({
            success: true,
            data: result.data || result,
            message: `채널 검색 완료 - ${(result.data || result).length}개 결과`,
            currentApiKeyIndex: result.currentApiKeyIndex || 0
        });
    } catch (error) {
        console.error('❌ 채널 검색 오류:', error);
        console.error('❌ 오류 스택:', error.stack);
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}



// YouTube 검색 메인 함수 (test.html의 searchYouTubeVideos 완전 포팅)
async function searchYouTubeVideos(searchParams, apiKeys) {
    const { 
        keyword, 
        maxResults, 
        timeFrame, 
        regionCode, 
        isViewsSort, 
        isAllVideos, 
        isVideoSearch,
        startDate,
        endDate 
    } = searchParams;
    
    let currentApiIndex = 0;
    
    // 현재 사용 중인 API 키 반환 (test.html과 동일)
    function getCurrentApiKey() {
        if (apiKeys.length === 0) return null;
        if (currentApiIndex >= apiKeys.length) currentApiIndex = 0;
        return apiKeys[currentApiIndex];
    }
    
    // 다음 API 키로 로테이션 (test.html과 동일)
    function rotateToNextApiKey() {
        if (apiKeys.length <= 1) return false;
        currentApiIndex = (currentApiIndex + 1) % apiKeys.length;
        console.log(`API 키 로테이션: 인덱스 ${currentApiIndex}로 전환`);
        return true;
    }
    
    // API 요청 함수 (로테이션 지원) - test.html과 완전 동일
    async function makeApiRequest(url, maxRetries = null) {
        if (maxRetries === null) {
            maxRetries = apiKeys.length;
        }
        
        if (apiKeys.length === 0) {
            throw new Error('사용 가능한 API 키가 없습니다.');
        }
        
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
        
        // 여기가 중요! 모든 시도가 실패했을 때 명시적으로 에러 던지기
        throw new Error('모든 API 키 시도 실패');
    }
    
    const sortBy = isViewsSort ? 'viewCount' : 'date';
    const videoLicense = isAllVideos ? '' : 'creativeCommon';

    let publishedAfter = '';
    let publishedBefore = '';
    
    if (timeFrame === 'custom') {
        // 날짜 직접 선택 (test.html과 동일)
        if (!startDate || !endDate) {
            throw new Error('시작일과 종료일을 모두 입력해주세요.');
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            throw new Error('시작일이 종료일보다 늘을 수 없습니다.');
        }
        
        // 한국시간으로 설정
        publishedAfter = new Date(startDate + 'T00:00:00+09:00').toISOString();
        publishedBefore = new Date(endDate + 'T23:59:59+09:00').toISOString();
        
    } else if (timeFrame) {
        // 기본 기간 옵션들 (한국시간 기준)
        const now = new Date();
        
        switch(timeFrame) {
            case 'hour':
                publishedAfter = new Date(now.getTime() - 60*60*1000).toISOString();
                break;
            case 'day':
                publishedAfter = new Date(now.getTime() - 24*60*60*1000).toISOString();
                break;
            case 'week':
                publishedAfter = new Date(now.getTime() - 7*24*60*60*1000).toISOString();
                break;
            case 'month':
                publishedAfter = new Date(now.getTime() - 30*24*60*60*1000).toISOString();
                break;
            case '3months':
                publishedAfter = new Date(now.getTime() - 90*24*60*60*1000).toISOString();
                break;
            case '6months':
                publishedAfter = new Date(now.getTime() - 180*24*60*60*1000).toISOString();
                break;
            case 'year':
                publishedAfter = new Date(now.getTime() - 365*24*60*60*1000).toISOString();
                break;
        }
    }

    // YouTube Data API v3 검색 (test.html과 완전 동일)
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `key=APIKEY_PLACEHOLDER&` +
        `part=snippet&` +
        `type=${isVideoSearch ? 'video' : 'channel'}&` +
        `maxResults=${maxResults}&` +
        `order=${sortBy}&` +
        `regionCode=${regionCode}`;
    
    // 국가별 언어 코드 매핑 (test.html과 완전 동일)
    const languageMapping = {
        "KR": "ko",   // 한국
        "JP": "ja",   // 일본
        "US": "en",   // 미국
        "TW": "zh-TW", // 대만
        "GB": "en",   // 영국
        "CA": "en",   // 캐나다
        "AU": "en",   // 호주
        "DE": "de",   // 독일
        "FR": "fr",   // 프랑스
        "ES": "es",   // 스페인
        "BR": "pt",   // 브라질
        "IN": "hi",   // 인도
        "RU": "ru"    // 러시아
    };
    
    // 해당 국가의 언어 설정 추가
    if (regionCode in languageMapping) {
        searchUrl += `&relevanceLanguage=${languageMapping[regionCode]}`;
    }
    
    // 검색어 처리 (test.html과 완전 동일)
    if (keyword) {
        searchUrl += `&q=${encodeURIComponent(keyword)}`;
    } else {
        // 검색어 없을 때는 일반적인 키워드 사용
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

    // 비디오 상세 정보 가져오기 (test.html과 동일)
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `key=APIKEY_PLACEHOLDER&` +
        `id=${videoIds}&` +
        `part=snippet,statistics,contentDetails`;

    const { response: videosResponse, data: videosData } = await makeApiRequest(videosUrl);

    // 채널 정보 가져오기 (test.html과 동일)
    const channelIds = [...new Set(videosData.items.map(item => item.snippet.channelId))].join(',');
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
        `key=APIKEY_PLACEHOLDER&` +
        `id=${channelIds}&` +
        `part=snippet,statistics`;

    const { response: channelsResponse, data: channelsData } = await makeApiRequest(channelsUrl);

    // 결과 조합 및 크리에이티브 커먼즈 필터링 (test.html과 완전 동일)
    let results = videosData.items.map((video, index) => {
        const channel = channelsData.items.find(ch => ch.id === video.snippet.channelId);
        const subscriberCount = parseInt(channel?.statistics?.subscriberCount || 0);
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        const likeCount = parseInt(video.statistics?.likeCount || 0);
        const commentCount = parseInt(video.statistics?.commentCount || 0);

        // CII 점수 계산 (test.html과 완전 동일한 공식)
        const channelTotalViewCount = parseInt(channel?.statistics?.viewCount || 0);
        const contributionValue = channelTotalViewCount > 0 ? (viewCount / channelTotalViewCount) * 100 : 0;
        const performanceValue = subscriberCount > 0 ? viewCount / subscriberCount : 0;
        const ciiScore = (contributionValue * 0.7) + (performanceValue * 30);

        let cii = 'Bad';
        if (ciiScore >= 70) cii = 'Great!!';
        else if (ciiScore >= 50) cii = 'Good';
        else if (ciiScore >= 30) cii = 'Soso';
        else if (ciiScore >= 10) cii = 'Not bad';
        
        // 쇼츠 여부 판단 (영상 길이 60초 이하를 쇼츠로 간주) - test.html과 완전 동일
        const durationParts = video.contentDetails?.duration?.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
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
            thumbnail: video.snippet?.thumbnails?.default?.url || '',
            title: video.snippet?.title || '',
            channelTitle: video.snippet?.channelTitle || '',
            channelId: video.snippet?.channelId || '', // 채널 ID 추가
            duration: formatDuration(video.contentDetails?.duration || ''),
            publishedAt: formatDate(video.snippet?.publishedAt || ''),
            publishedAtRaw: video.snippet?.publishedAt || '', // 정렬용 원시 데이터 추가
            subscriberCount: subscriberCount,
            viewCount: viewCount,
            contributionValue: parseFloat(contributionValue.toFixed(2)), // 정렬용 숫자값
            performanceValue: parseFloat(performanceValue.toFixed(2)), // 정렬용 숫자값
            cii: cii,
            ciiScore: parseFloat(ciiScore.toFixed(1)), // 정렬용 숫자값
            commentCount: commentCount,
            likeCount: likeCount,
            totalVideos: parseInt(channel?.statistics?.videoCount || 0),
            videoId: video.id || '',
            license: video.status?.license || 'youtube',
            isShorts: isShorts,
            engagementRate: viewCount > 0 ? parseFloat(((likeCount + commentCount) / viewCount * 100).toFixed(1)) : 0, // 정렬용 숫자값
            description: video.snippet?.description || '' // 설명 추가
        };
    });

    // test.html과 동일한 클라이언트 재정렬
    if (isViewsSort) {
        // 조회수순 정렬 (내림차순)
        results = results.sort((a, b) => b.viewCount - a.viewCount);
    } else {
        // 최신순 정렬 (시간순 내림차순)
        results = results.sort((a, b) => new Date(b.publishedAtRaw) - new Date(a.publishedAtRaw));
    }
    
    // 인덱스 재조정 (정렬 후) - test.html과 동일
    results = results.map((item, index) => ({
        ...item,
        index: index + 1
    }));

    // 크리에이티브 커먼즈 필터링 (클라이언트 사이드) - test.html과 동일
    if (!isAllVideos) {
        results = results.filter(video => video.license === 'creativeCommon');
    }

    return results;
}

// 단일 비디오 데이터 가져오기 함수 (test.html의 fetchSingleVideoData 완전 포팅)
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
        // 1. 비디오 상세 정보 가져오기 (test.html과 동일)
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `key=APIKEY_PLACEHOLDER&` +
            `id=${videoId}&` +
            `part=snippet,statistics,contentDetails`;
        
        const { response: videosResponse, data: videosData } = await makeApiRequest(videosUrl);
        
        if (!videosData.items || videosData.items.length === 0) {
            return null;
        }
        
        const video = videosData.items[0];
        
        // 2. 채널 정보 가져오기 (test.html과 동일)
        const channelId = video.snippet?.channelId;
        if (!channelId) return null;
        
        const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
            `key=APIKEY_PLACEHOLDER&` +
            `id=${channelId}&` +
            `part=snippet,statistics`;
        
        const { response: channelsResponse, data: channelsData } = await makeApiRequest(channelsUrl);
        
        if (!channelsData.items || channelsData.items.length === 0) {
            return null;
        }
        
        const channel = channelsData.items[0];
        
        // 3. 데이터 조합 및 계산 (기존 검색과 동일한 로직) - test.html과 동일
        const subscriberCount = parseInt(channel.statistics?.subscriberCount || 0);
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        const likeCount = parseInt(video.statistics?.likeCount || 0);
        const commentCount = parseInt(video.statistics?.commentCount || 0);
        
        // CII 점수 계산 (test.html과 동일)
        const channelTotalViewCount = parseInt(channel.statistics?.viewCount || 0);
        const contributionValue = channelTotalViewCount > 0 ? (viewCount / channelTotalViewCount) * 100 : 0;
        const performanceValue = subscriberCount > 0 ? viewCount / subscriberCount : 0;
        const ciiScore = (contributionValue * 0.7) + (performanceValue * 30);
        
        let cii = 'Bad';
        if (ciiScore >= 70) cii = 'Great!!';
        else if (ciiScore >= 50) cii = 'Good';
        else if (ciiScore >= 30) cii = 'Soso';
        else if (ciiScore >= 10) cii = 'Not bad';
        
        // 쇼츠 여부 판단 (영상 길이 60초 이하를 쇼츠로 간주) - test.html과 동일
        const durationParts = video.contentDetails?.duration?.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        let totalSeconds = 0;
        if (durationParts) {
            const hours = durationParts[1] ? parseInt(durationParts[1].replace('H', '')) : 0;
            const minutes = durationParts[2] ? parseInt(durationParts[2].replace('M', '')) : 0;
            const seconds = durationParts[3] ? parseInt(durationParts[3].replace('S', '')) : 0;
            totalSeconds = hours * 3600 + minutes * 60 + seconds;
        }
        const isShorts = totalSeconds <= 60;
        
        // 결과 객체 생성 (기존 displayResults 함수와 호환) - test.html과 동일
        return {
            index: 1,
            thumbnail: video.snippet?.thumbnails?.default?.url || '',
            title: video.snippet?.title || '',
            channelTitle: video.snippet?.channelTitle || '',
            channelId: video.snippet?.channelId || '',
            duration: formatDuration(video.contentDetails?.duration || ''),
            publishedAt: formatDate(video.snippet?.publishedAt || ''),
            publishedAtRaw: video.snippet?.publishedAt || '',
            subscriberCount: subscriberCount,
            viewCount: viewCount,
            contributionValue: parseFloat(contributionValue.toFixed(2)),
            performanceValue: parseFloat(performanceValue.toFixed(2)),
            cii: cii,
            ciiScore: parseFloat(ciiScore.toFixed(1)),
            commentCount: commentCount,
            likeCount: likeCount,
            totalVideos: parseInt(channel.statistics?.videoCount || 0),
            videoId: video.id || '',
            license: video.status?.license || 'youtube',
            isShorts: isShorts,
            engagementRate: viewCount > 0 ? parseFloat(((likeCount + commentCount) / viewCount * 100).toFixed(1)) : 0,
            description: video.snippet?.description || ''
        };
        
    } catch (error) {
        console.error('단일 비디오 데이터 가져오기 오류:', error);
        throw error;
    }
}

// 필터 적용 함수 (test.html의 applyFilters 완전 포팅)
function applyFilters(results, filters) {
    let filteredResults = [];
    
    for (let result of results) {
        let shouldInclude = true;
        
        // 비디오 타입 필터 (쇼츠/롱폼) - test.html과 동일
        if (filters.shorts || filters.longform) {
            const isShorts = result.isShorts || false;
            
            if (filters.shorts && !filters.longform) {
                if (!isShorts) shouldInclude = false;
            } else if (filters.longform && !filters.shorts) {
                if (isShorts) shouldInclude = false;
            }
        }
        
        // CII 필터 - test.html과 동일
        if (filters.ciiGreat || filters.ciiGood || filters.ciiSoso) {
            const cii = result.cii;
            if (!((filters.ciiGreat && cii === 'Great!!') ||
                  (filters.ciiGood && cii === 'Good') ||
                  (filters.ciiSoso && cii === 'Soso'))) {
                shouldInclude = false;
            }
        }
        
        // 조회수 필터 - test.html과 동일
        if (filters.viewCount) {
            const minViews = parseInt(filters.viewCount);
            if (result.viewCount < minViews) {
                shouldInclude = false;
            }
        }
        
        // 구독자수 필터 (이하 조건) - test.html과 동일
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

// 번역 기능 (test.html의 translateSearchTerm + deeplTranslate + googleTranslate 완전 포팅)
async function translateSearchTerm(regionCode, searchTerm) {
    try {
        // 국가별 언어 코드 매핑 (test.html과 동일)
        const languageMapping = {
            "KR": "ko", "JP": "ja", "US": "en", "TW": "zh-TW", "GB": "en",
            "CA": "en", "AU": "en", "DE": "de", "FR": "fr", "ES": "es",
            "BR": "pt", "IN": "hi", "RU": "ru"
        };
        
        const targetLang = languageMapping[regionCode];
        if (!targetLang || targetLang === 'ko') return null;
        
        let translatedText = null;
        
        // DeepL API 먼저 시도 (test.html과 동일)
        try {
            translatedText = await deeplTranslate(searchTerm, targetLang);
            console.log(`DeepL 번역 성공: ${searchTerm} → ${translatedText}`);
        } catch (deeplError) {
            console.log(`DeepL API 오류 (할당량 초과 가능성): ${deeplError.message}`);
            // Google Translate로 fallback
            translatedText = await googleTranslate(searchTerm, targetLang);
        }
        
        if (translatedText && translatedText.toLowerCase() !== searchTerm.toLowerCase()) {
            console.log(`번역 성공: ${searchTerm} → ${translatedText}`);
            return translatedText;
        }
        
        return null;
        
    } catch (error) {
        console.error('번역 오류:', error);
        return null;
    }
}

// DeepL API 번역 (test.html과 완전 동일)
async function deeplTranslate(text, targetLang) {
    const DEEPL_API_KEY = "be5e533d-d3c1-42a8-8b18-487283baccb5:fx"; // test.html과 동일
    
    // DeepL 언어 코드 매핑 (test.html과 완전 동일)
    const deeplLangMap = {
        "ja": "JA",
        "en": "EN-US", 
        "ko": "KO",
        "zh-TW": "ZH",
        "fr": "FR",
        "de": "DE",
        "es": "ES",
        "pt": "PT-BR",
        "ru": "RU",
        "hi": "EN-US" // 힌디어는 DeepL에서 지원하지 않으므로 영어로
    };
    
    const deeplTarget = deeplLangMap[targetLang] || targetLang.toUpperCase();
    
    try {
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'text': text,
                'target_lang': deeplTarget,
                'source_lang': 'KO' // 한국어에서 번역
            })
        });
        
        if (!response.ok) {
            if (response.status === 403 || response.status === 456) {
                throw new Error('DeepL 할당량 초과');
            }
            throw new Error(`DeepL API 오류: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.translations && data.translations.length > 0) {
            return data.translations[0].text;
        }
        throw new Error('DeepL 번역 결과 없음');
        
    } catch (error) {
        throw error;
    }
}

// Google Translate 무료 웹 API 사용 (test.html과 완전 동일)
async function googleTranslate(text, targetLang) {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        
        if (data && data[0] && data[0][0] && data[0][0][0]) {
            return data[0][0][0];
        }
        return null;
    } catch (error) {
        console.error('Google Translate 오류:', error);
        return null;
    }
}

// 상세한 채널 정보 가져오기 (test.html의 fetchDetailedChannelInfo 완전 포팅)
async function fetchDetailedChannelInfo(channelId, apiKeys) {
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

    // API 요청 함수 (로테이션 지원) - test.html과 동일
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
                    throw new Error(data.error?.message || '채널 정보 가져오기가 실패했습니다.');
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
    
    // 1. 채널 기본 정보 가져오기 (test.html과 동일)
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?` +
        `key=APIKEY_PLACEHOLDER&` +
        `part=snippet,statistics,contentDetails&` +
        `id=${channelId}`;
    
    const { response: channelResponse, data: channelData } = await makeApiRequest(channelUrl);
    
    if (!channelData.items || channelData.items.length === 0) {
        return null;
    }
    
    const channelInfo = channelData.items[0];
    const uploadPlaylist = channelInfo.contentDetails?.relatedPlaylists?.uploads;
    
    if (!uploadPlaylist) {
        return null;
    }
    
    // 2. 채널 영상 목록 가져오기 (최근 50개) - test.html과 동일
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?` +
        `key=APIKEY_PLACEHOLDER&` +
        `part=snippet&` +
        `playlistId=${uploadPlaylist}&` +
        `maxResults=50`;
    
    const { response: playlistResponse, data: playlistData } = await makeApiRequest(playlistUrl);
    const videos = playlistData.items || [];
    
    if (videos.length === 0) {
        return { channelInfo, top3Videos: [], videosWithStats: [] };
    }
    
    // 3. 비디오 상세 정보 가져오기 (조회수, 좋아요 등) - test.html과 동일
    const videoIds = videos.map(item => item.snippet.resourceId.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `key=APIKEY_PLACEHOLDER&` +
        `id=${videoIds}&` +
        `part=snippet,statistics`;
    
    const { response: videosResponse, data: videosData } = await makeApiRequest(videosUrl);
    const videoDetails = videosData.items || [];
    
    // 4. 비디오 데이터 매핑 및 TOP3 계산 (test.html과 동일)
    const videosMap = {};
    videoDetails.forEach(video => {
        videosMap[video.id] = video;
    });
    
    const videosWithStats = [];
    videos.forEach(item => {
        const videoId = item.snippet.resourceId.videoId;
        const videoInfo = videosMap[videoId];
        
        if (videoInfo) {
            const viewCount = parseInt(videoInfo.statistics?.viewCount || 0);
            const likeCount = parseInt(videoInfo.statistics?.likeCount || 0);
            const commentCount = parseInt(videoInfo.statistics?.commentCount || 0);
            
            // 기여도와 성과도 계산 (test.html과 동일)
            const channelTotalViews = parseInt(channelInfo.statistics?.viewCount || 0);
            const subscriberCount = parseInt(channelInfo.statistics?.subscriberCount || 0);
            const contribution = channelTotalViews > 0 ? (viewCount / channelTotalViews) * 100 : 0;
            const performance = subscriberCount > 0 ? viewCount / subscriberCount : 0;
            
            videosWithStats.push({
                id: videoId,
                snippet: item.snippet,
                statistics: videoInfo.statistics,
                viewCount: viewCount,
                likeCount: likeCount,
                commentCount: commentCount,
                contribution: contribution,
                performance: performance,
                url: `https://www.youtube.com/watch?v=${videoId}`
            });
        }
    });
    
    // 조회수 기준으로 정렬하여 TOP3 선택 (test.html과 동일)
    videosWithStats.sort((a, b) => b.viewCount - a.viewCount);
    const top3Videos = videosWithStats.slice(0, 3);
    
    return {
        channelInfo,
        top3Videos,
        videosWithStats,
        uploadPlaylist
    };
}

// 채널 영상 수집 함수 (test.html의 fetchChannelVideos 완전 포팅)
async function fetchChannelVideos(channelId, uploadPlaylist, maxResults, apiKeys) {
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
                    throw new Error(data.error?.message || '채널 영상 수집이 실패했습니다.');
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
    
    // 채널 기본 정보 가져오기
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?` +
        `key=APIKEY_PLACEHOLDER&` +
        `part=snippet,statistics&` +
        `id=${channelId}`;
    
    const { response: channelResponse, data: channelData } = await makeApiRequest(channelUrl);
    
    if (!channelData.items || channelData.items.length === 0) {
        return [];
    }
    
    const channelInfo = channelData.items[0];
    
    // 업로드 플레이리스트에서 영상 목록 가져오기
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?` +
        `key=APIKEY_PLACEHOLDER&` +
        `part=snippet&` +
        `playlistId=${uploadPlaylist}&` +
        `maxResults=${maxResults}`;
    
    const { response: playlistResponse, data: playlistData } = await makeApiRequest(playlistUrl);
    const videos = playlistData.items || [];
    
    if (videos.length === 0) {
        return [];
    }
    
    // 비디오 상세 정보 가져오기
    const videoIds = videos.map(item => item.snippet.resourceId.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `key=APIKEY_PLACEHOLDER&` +
        `id=${videoIds}&` +
        `part=snippet,statistics,contentDetails`;
    
    const { response: videosResponse, data: videosData } = await makeApiRequest(videosUrl);
    const videoDetails = videosData.items || [];
    
    // 비디오 데이터 매핑
    const videosMap = {};
    videoDetails.forEach(video => {
        videosMap[video.id] = video;
    });
    
    // 결과 조합 (test.html과 동일한 로직)
    const results = [];
    videos.forEach((item, index) => {
        const videoId = item.snippet.resourceId.videoId;
        const videoInfo = videosMap[videoId];
        
        if (videoInfo) {
            const subscriberCount = parseInt(channelInfo.statistics?.subscriberCount || 0);
            const viewCount = parseInt(videoInfo.statistics?.viewCount || 0);
            const likeCount = parseInt(videoInfo.statistics?.likeCount || 0);
            const commentCount = parseInt(videoInfo.statistics?.commentCount || 0);

            // CII 점수 계산 (test.html과 동일)
            const channelTotalViewCount = parseInt(channelInfo.statistics?.viewCount || 0);
            const contributionValue = channelTotalViewCount > 0 ? (viewCount / channelTotalViewCount) * 100 : 0;
            const performanceValue = subscriberCount > 0 ? viewCount / subscriberCount : 0;
            const ciiScore = (contributionValue * 0.7) + (performanceValue * 30);

            let cii = 'Bad';
            if (ciiScore >= 70) cii = 'Great!!';
            else if (ciiScore >= 50) cii = 'Good';
            else if (ciiScore >= 30) cii = 'Soso';
            else if (ciiScore >= 10) cii = 'Not bad';
            
            // 쇼츠 여부 판단 (test.html과 동일)
            const durationParts = videoInfo.contentDetails?.duration?.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
            let totalSeconds = 0;
            if (durationParts) {
                const hours = durationParts[1] ? parseInt(durationParts[1].replace('H', '')) : 0;
                const minutes = durationParts[2] ? parseInt(durationParts[2].replace('M', '')) : 0;
                const seconds = durationParts[3] ? parseInt(durationParts[3].replace('S', '')) : 0;
                totalSeconds = hours * 3600 + minutes * 60 + seconds;
            }
            const isShorts = totalSeconds <= 60;

            results.push({
                index: index + 1,
                thumbnail: videoInfo.snippet?.thumbnails?.default?.url || '',
                title: videoInfo.snippet?.title || '',
                channelTitle: channelInfo.snippet?.title || '',
                channelId: channelId,
                duration: formatDuration(videoInfo.contentDetails?.duration || ''),
                publishedAt: formatDate(videoInfo.snippet?.publishedAt || ''),
                publishedAtRaw: videoInfo.snippet?.publishedAt || '',
                subscriberCount: subscriberCount,
                viewCount: viewCount,
                contributionValue: parseFloat(contributionValue.toFixed(2)),
                performanceValue: parseFloat(performanceValue.toFixed(2)),
                cii: cii,
                ciiScore: parseFloat(ciiScore.toFixed(1)),
                commentCount: commentCount,
                likeCount: likeCount,
                totalVideos: parseInt(channelInfo.statistics?.videoCount || 0),
                videoId: videoId,
                license: videoInfo.status?.license || 'youtube',
                isShorts: isShorts,
                engagementRate: viewCount > 0 ? parseFloat(((likeCount + commentCount) / viewCount * 100).toFixed(1)) : 0,
                description: videoInfo.snippet?.description || ''
            });
        }
    });
    
    return results;
}

// 채널 검색 함수 (test.html의 searchChannelByName 완전 포팅)
// 채널 검색 함수 (test.html의 searchChannelByName 완전 포팅)
async function searchChannelByName(channelName, regionCode, apiKeys, startApiKeyIndex = 0) {
    let currentApiIndex = startApiKeyIndex;
    
    console.log('채널 검색 시작:', { channelName, regionCode, apiKeysCount: apiKeys?.length, startApiKeyIndex });
    
    function getCurrentApiKey() {
        if (!apiKeys || apiKeys.length === 0) return null;
        if (currentApiIndex >= apiKeys.length) currentApiIndex = 0;
        return apiKeys[currentApiIndex];
    }
    
    function rotateToNextApiKey() {
        if (!apiKeys || apiKeys.length <= 1) return false;
        currentApiIndex = (currentApiIndex + 1) % apiKeys.length;
        return true;
    }

    async function makeApiRequest(url, maxRetries = null) {
        if (maxRetries === null) {
            maxRetries = apiKeys ? apiKeys.length : 1;
        }
        
        if (!apiKeys || apiKeys.length === 0) {
            throw new Error('사용 가능한 API 키가 없습니다.');
        }
        
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
                    throw new Error(data.error?.message || '채널 검색이 실패했습니다.');
                }
            } catch (fetchError) {
                if (attempt === maxRetries - 1) {
                    throw fetchError;
                }
                console.log(`네트워크 오류, 다음 키로 시도: ${fetchError.message}`);
                rotateToNextApiKey();
            }
        }
        
        throw new Error('모든 API 키 시도 실패');
    }
    
    try {
        // 1. 채널 검색
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `key=APIKEY_PLACEHOLDER&` +
            `part=snippet&` +
            `type=channel&` +
            `q=${encodeURIComponent(channelName)}&` +
            `maxResults=50&` +
            `regionCode=${regionCode}`;
        
        console.log('채널 검색 API 호출 시작');
        const { response: searchResponse, data: searchData } = await makeApiRequest(searchUrl);
        console.log('채널 검색 응답:', searchData);
        
        const searchChannels = searchData?.items || [];
        
        if (searchChannels.length === 0) {
            console.log('검색된 채널 없음');
            return { data: [], currentApiKeyIndex: currentApiIndex };
        }
        
        // 2. 채널 세부 정보 가져오기
        const channelIds = searchChannels.map(channel => channel.id?.channelId).filter(id => id).join(',');
        if (!channelIds) {
            console.log('유효한 채널 ID 없음');
            return { data: [], currentApiKeyIndex: currentApiIndex };
        }
        
        const detailsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
            `key=APIKEY_PLACEHOLDER&` +
            `part=snippet,statistics,contentDetails&` +
            `id=${channelIds}`;
        
        console.log('채널 상세정보 API 호출 시작');
        const { response: detailsResponse, data: detailsData } = await makeApiRequest(detailsUrl);
        console.log('채널 상세정보 응답:', detailsData);
        
        const channelDetails = detailsData?.items || [];
        
        // 3. 채널 정보 매핑
        const channelInfoMap = {};
        channelDetails.forEach(item => {
            if (item && item.id) {
                channelInfoMap[item.id] = item;
            }
        });
        
        // 4. 검색어와 일치 여부 확인 및 정보 조합
        const exactMatchChannels = [];
        const partialMatchChannels = [];
        
        searchChannels.forEach(channel => {
            if (!channel?.id?.channelId) return;
            
            const channelId = channel.id.channelId;
            const details = channelInfoMap[channelId];
            
            if (!details) return;
            
            const channelTitle = details.snippet?.title || '';
            const channelDescription = details.snippet?.description || '';
            const subscriberCount = parseInt(details.statistics?.subscriberCount || 0);
            const totalVideos = parseInt(details.statistics?.videoCount || 0);
            const thumbnailUrl = details.snippet?.thumbnails?.high?.url || details.snippet?.thumbnails?.default?.url || '';
            const uploadPlaylist = details.contentDetails?.relatedPlaylists?.uploads || '';
            
            // 검색어와 일치 여부 확인
            const searchTermLower = channelName.toLowerCase();
            const isExactMatch = (
                channelTitle.toLowerCase() === searchTermLower ||
                channelTitle.toLowerCase().startsWith(searchTermLower) ||
                channelTitle.toLowerCase().endsWith(searchTermLower)
            );
            
            const channelData = {
                id: channelId,
                title: channelTitle,
                description: channelDescription,
                subscriberCount: subscriberCount,
                videoCount: totalVideos,
                thumbnailUrl: thumbnailUrl,
                uploadPlaylist: uploadPlaylist,
                isExactMatch: isExactMatch
            };
            
            if (isExactMatch) {
                exactMatchChannels.push(channelData);
            } else {
                partialMatchChannels.push(channelData);
            }
        });
        
        // 정확한 일치 채널을 먼저, 그 다음 부분 일치 채널
        const allChannels = exactMatchChannels.concat(partialMatchChannels);
        console.log('최종 채널 결과:', allChannels);
        
        return { data: allChannels, currentApiKeyIndex: currentApiIndex };
        
    } catch (error) {
        console.error('채널 검색 전체 오류:', error);
        throw error;
    }
}


// 유틸리티 함수들 (test.html과 완전 동일, null 체크 추가)
function formatDuration(duration) {
    if (!duration) return '0:00';
    
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';
    
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
    if (!dateStr) return '알 수 없음';
    
    try {
        const date = new Date(dateStr);
        // 한국시간으로 명시적 변환
        return date.toLocaleDateString('ko-KR', {timeZone: 'Asia/Seoul'}) + ' ' + 
               date.toLocaleTimeString('ko-KR', {timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit'});
    } catch (error) {
        return '알 수 없음';
    }
}

// YouTube URL에서 비디오 ID 추출 함수 (test.html과 완전 동일)
function extractVideoId(url) {
    if (!url) return null;
    
    // 다양한 YouTube URL 형식 지원
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
