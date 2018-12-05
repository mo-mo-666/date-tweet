// 参照：https://gist.github.com/kijtra/f4cdd8775277372d42f7


// 最初にこの関数を実行し、ログに出力されたURLにアクセスしてOAuth認証する
function twitterAuthorizeUrl() {
  Twitter.oauth.showUrl();
}

// OAuth認証成功後のコールバック関数
function twitterAuthorizeCallback(request) {
  return Twitter.oauth.callback(request);
}

// OAuth認証のキャッシュをを削除する場合はこれを実行（実行後は再度認証が必要）
function twitterAuthorizeClear() {
  Twitter.oauth.clear();
}


var Twitter = {
  //projectKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  scriptId: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  
  consumerKey: "XXXXXXXXXXXXXXXXXXXXXXXXX",
  consumerSecret: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  
  apiUrl: "https://api.twitter.com/1.1/",
  
  oauth: {
    name: "twitter",
    
    service: function(screen_name) {
      // 参照元：https://github.com/googlesamples/apps-script-oauth2
      
      return OAuth1.createService(this.name)
      // Set the endpoint URLs.
      .setAccessTokenUrl('https://api.twitter.com/oauth/access_token')
      .setRequestTokenUrl('https://api.twitter.com/oauth/request_token')
      .setAuthorizationUrl('https://api.twitter.com/oauth/authorize')
      
      // Set the consumer key and secret.
      .setConsumerKey(this.parent.consumerKey)
      .setConsumerSecret(this.parent.consumerSecret)
      
      // Set the scriptId of the script using this library.
      //.setProjectKey(this.parent.projectKey)
      .setScriptId(this.parent.scriptId)
      
      
      // Set the name of the callback function in the script referenced
      // above that should be invoked to complete the OAuth flow.
      .setCallbackFunction('twitterAuthorizeCallback')
      
      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties());
    },
    
    showUrl: function() {
      var service = this.service();
      if (!service.hasAccess()) {
        Logger.log(service.authorize());
      } else {
        Logger.log("認証済みです");
      }
    },
    
    callback: function (request) {
      var service = this.service();
      var isAuthorized = service.handleCallback(request);
      if (isAuthorized) {
        return HtmlService.createHtmlOutput("認証に成功しました！このタブは閉じてかまいません。");
      } else {
        return HtmlService.createHtmlOutput("認証に失敗しました・・・");
      }
    },
    
    clear: function(){
      OAuth1.createService(this.name)
      .setPropertyStore(PropertiesService.getUserProperties())
      .reset();
    }
  },
  
  api: function(path, data) {
    var that = this, service = this.oauth.service();
    if (!service.hasAccess()) {
      Logger.log("先にOAuth認証してください");
      return false;
    }
    
    path = path.toLowerCase().replace(/^\//, '').replace(/\.json$/, '');
    
    var method = (
         /^statuses\/(destroy\/\d+|update|retweet\/\d+)/.test(path)
      || /^media\/upload/.test(path)
      || /^direct_messages\/(destroy|new)/.test(path)
      || /^friendships\/(create|destroy|update)/.test(path)
      || /^account\/(settings|update|remove)/.test(path)
      || /^blocks\/(create|destroy)/.test(path)
      || /^mutes\/users\/(create|destroy)/.test(path)
      || /^favorites\/(destroy|create)/.test(path)
      || /^lists\/[^\/]+\/(destroy|create|update)/.test(path)
      || /^saved_searches\/(create|destroy)/.test(path)
      || /^geo\/place/.test(path)
      || /^users\/report_spam/.test(path)
      ) ? "post" : "get";
    
    var url = this.apiUrl + path + ".json";
    var options = {
      method: method,
      muteHttpExceptions: true
    };
    
    if ("get" === method) {
      if (!this.isEmpty(data)) {
        
        url += '?' + Object.keys(data).map(function(key) {
          return that.encodeRfc3986(key) + '=' + that.encodeRfc3986(data[key]);
        }).join('&');
      }
    } else if ("post" == method) {
      if (!this.isEmpty(data)) {
        
        options.payload = Object.keys(data).map(function(key) {
          return that.encodeRfc3986(key) + '=' + that.encodeRfc3986(data[key]);
        }).join('&');
        
        if (data.media) {
          options.contentType = "multipart/form-data;charset=UTF-8";
        }
      }
    }

    try {
      var result = service.fetch(url, options);
      var json = JSON.parse(result.getContentText());
      if (json) {
        if (json.error) {
          throw new Error(json.error + " (" + json.request + ")");
        } else if (json.errors) {
          var err = [];
          for (var i = 0, l = json.errors.length; i < l; i++) {
            var error = json.errors[i];
            err.push(error.message + " (code: " + error.code + ")");
          }
          throw new Error(err.join("\n"));
        } else {
          return json;
        }
      }
    } catch(e) {
      this.error(e);
    }
    
    return false;
  },
  
  error: function(error) {
    var message = null;
    if ('object' === typeof error && error.message) {
      message = error.message + " ('" + error.fileName + '.gs:' + error.lineNumber +")";
    } else {
      message = error;
    }
    
    Logger.log(message);
  },
  
  isEmpty: function(obj) {
    if (obj == null) return true;
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }
    return true;
  },
  
  encodeRfc3986: function(str) {
    return encodeURIComponent(str).replace(/[!'()]/g, function(char) {
      return escape(char);
    }).replace(/\*/g, "%2A");
  },
  
  init: function() {
    this.oauth.parent = this;
    return this;
  }
}.init();


/********************************************************************
以下はサポート関数
*/

// ツイート検索
Twitter.search = function(data) {
  if ("string" === typeof data) {
    data = {q: data};
  }
  
  return this.api("search/tweets", data);
};

// 自分のタイムライン取得
Twitter.tl = function(since_id) {
  var data = null;
  
  if ("number" === typeof since_id || /^\d+$/.test(''+since_id)) {
    data = {since_id: since_id};
  } else if("object" === typeof since_id) {
    data = since_id;
  }
  
  return this.api("statuses/home_timeline", data);
};

// ユーザーのタイムライン取得
Twitter.usertl = function(user, since_id) {
  var path = "statuses/user_timeline";
  var data = {};
  
  if (user) {
    if (/^\d+$/.test(user)) {
      data.user_id = user;
    } else {
      data.screen_name = user;
    }
  } else {
    var path = "statuses/home_timeline";
  }
  
  if (since_id) {
    data.since_id = since_id;
  }
  
  return this.api(path, data);
};

// ツイートする
Twitter.tweet = function(data, reply) {
  var path = "statuses/update";
  if ("string" === typeof data) {
    data = {status: data};
  } else if(data.media) {
    path = "statuses/update_with_media ";
  }
  
  if (reply) {
    data.in_reply_to_status_id = reply;
  }
  
  return this.api(path, data);
};

// トレンド取得（日本）
Twitter.trends = function(woeid) {
  data = {id: woeid || 1118108};
  var res = this.api("trends/place", data);
  return (res && res[0] && res[0].trends && res[0].trends.length) ? res[0].trends : null;
};

// トレンドのワードのみ取得
Twitter.trendWords = function(woeid) {
  data = {id: woeid || 1118108};
  var res = this.api("trends/place", data);
  if (res && res[0] && res[0].trends && res[0].trends.length) {
    var trends = res[0].trends;
    var words = [];
    for(var i = 0, l = trends.length; i < l; i++) {
      words.push(trends[i].name);
    }
    return words;
  }
};

/********************************************************************/
//トリガー設定

// 0時0分にトリガーを設定
function setTrigger() {
  var triggerDay = new Date();
  triggerDay.setDate(triggerDay.getDate() + 1);
  triggerDay.setHours(0);
  triggerDay.setMinutes(0);
  triggerDay.setSeconds(0);
  ScriptApp.newTrigger("main").timeBased().at(triggerDay).create();
}

// その日のトリガーを削除する関数(消さないと残る)
function deleteTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for(var i=0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() == "main") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}


/********************************************************************/


var weatherObj = {
  cityId: {
    'Sapporo': '016010',
    'Tokyo': '130010',
    'Nagoya': '230010',
    'Osaka': '270000',
    'Hakata': '400010',
  },
  
  parseOneCity: function(today, id) {
    var url = "http://weather.livedoor.com/forecast/webservice/json/v1?city=" + id;

    // 天気情報のJSONデータを取得
    var json = UrlFetchApp.fetch(url).getContentText();
    var jsonData = JSON.parse(json);
    var forecasts = jsonData.forecasts;
    for (var i = 0; i < forecasts.length; i++) {
      if (forecasts[i].date == today) {
        var forecastToday = forecasts[i];
        var weather = forecastToday.telop;
        var templ;
        var temph;
        if (forecastToday.temperature.min != null) {
          templ = forecastToday.temperature.min.celsius;
        } else {
          templ = '*';
        }
        if (forecastToday.temperature.max != null) {
          temph = forecastToday.temperature.max.celsius;
        } else {
          temph = '*';
        }
      }
    } 
    return [weather, templ, temph]; 
  },

  parseAll: function() {
    var CITYID = ['016010', '130010','230010', '270000', '400010']   // 少し上を見よ
    var today = new Date();
    var todayForm = today.getFullYear() + '-' +  ( '0' + (today.getMonth()+1)).slice(-2) + '-' + ( '0' + today.getDate()).slice(-2);
    var weatherAll = new Array();
    for(var i = 0;  i < CITYID.length; i++) {
      var w = this.parseOneCity(todayForm, CITYID[i]);
      weatherAll.push(w);
    }
    
    return weatherAll;
  }  
};


var timeObj = {  
  cityId: {
    Sapporo: [43.0686645,141.3485666],
    Tokyo: [35.6811493,139.7663218],
    Nagoya: [35.1709194,136.8793483],
    Osaka: [34.7027104,135.4942307],
    Hakata: [33.5897319,130.4185387],
  },
  
  parseOneCity: function(today, idlist) {
    var url = 'http://labs.bitmeister.jp/ohakon/api/?mode=sun_moon_rise_set' 
                   + '&year=' + today[0] + '&month=' + today[1] + '&day=' + today[2]
                   + '&lat=' + idlist[0] + '&lng=' + idlist[1];
    
    var xml = UrlFetchApp.fetch(url).getContentText("ISO-8859-1");
    var xmlData = XmlService.parse(xml);
    var root = xmlData.getRootElement();
    var riseSetTime = root.getChild('rise_and_set');
    var sunRise = riseSetTime.getChild('sunrise_hm').getValue();
    var sunSet = riseSetTime.getChild('sunset_hm').getValue();
    //var moonRise = riseSetTime.getChild('moonrise_hm').getValue();
    //var moonSet = riseSetTime.getChild('moonset_hm').getValue();
    //var moonAge = root.getChild('moon_age').getValue();
    
    return [sunRise, sunSet];
  },
  
  parseAll: function() {
    var today = new Date();
    var todayForm = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
    var places = [[43.0686645,141.3485666], [35.6811493,139.7663218], [35.1709194,136.8793483], [34.7027104,135.4942307], [33.5897319,130.4185387]]
    var timeAll = [];
    for(var i = 0; i < places.length; i++) {
      var w = this.parseOneCity(todayForm, places[i]);
      timeAll.push(w);
    }
    
    return timeAll;
  },
}



// 実行したいスクリプト本体
function main() {
  var wl = weatherObj.parseAll();
  var tl = timeObj.parseAll();
 
  var today = new Date();
  var daylist = ["日", "月", "火", "水", "木", "金", "土"];
  var todayForm = today.getFullYear() + '/' + (today.getMonth()+1) + '/' + today.getDate() + '[' + daylist[today.getDay()] + ']';
  
  var result = todayForm + '\n' 
              + '地域：：天気/気温/日照\n'
              + '札幌：：' + wl[0][0] + '/' + wl[0][1] + '~' + wl[0][2] + '°' + '/' 
                        + tl[0][0] + '~' + tl[0][1] + '\n'
              + '東京：：' + wl[1][0] + '/' + wl[1][1] + '~' + wl[1][2] + '°' + '/' 
                        + tl[1][0] + '~' + tl[1][1] + '\n'
              + '名古屋：' + wl[2][0] + '/' + wl[2][1] + '~' + wl[2][2] + '°' + '/' 
                        + tl[2][0] + '~' + tl[2][1] + '\n'
              + '大阪：：' + wl[3][0] + '/' + wl[3][1] + '~' + wl[3][2] + '°' + '/' 
                        + tl[3][0] + '~' + tl[3][1] + '\n'
              + '博多：：' + wl[4][0] + '/' + wl[4][1] + '~' + wl[4][2] + '°' + '/' 
                        + tl[4][0] + '~' + tl[4][1] + '\n';
  
  Twitter.tweet(result);
  
  deleteTrigger();
}
  
