/**
 * Script: home/client-web/js/index
 *
 * Main applet for the Home Page tool.
 * 
 * Credits:
 * 
 *   Written by Marshall Elfstrand (marshall@vengefulcow.com).
 * 
 * Copyright / License:
 * 
 *   Copyright 2009 Mission Aviation Fellowship
 * 
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * Version:
 *   $Id: index.js 82 2008-04-02 22:26:09Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: Home
 *
 * The module containing all Home Page classes and data.
 */
@module Home;

// ---------------------------------------------------------------------------

/**
 * Class: Home.IndexApplet
 * 
 * The main applet class for the Home Page.  Displays the latest news,
 * weather, upcoming calendar events, helpful tips, and so on.
 */
@class IndexApplet {

  var DATE_UPDATE_INTERVAL  = (1000 * 60 * 5);   // Refresh dates every 5 mins
  var CACHE_EXPIRE_INTERVAL = (1000 * 60 * 30);  // Refresh news after 30 mins

  var _newsDates = [];     // News date fields to update every 5 minutes
  var _weatherDates = [];  // Weather date fields to update every 5 minutes

  /**
   * Method: initialize
   *
   * Initializes the applet.
   */
  @method initialize() {
  }
  
  /**
   * Method: loadPath
   *
   * Loads the user's home page data.
   *
   * This first checks to see if the home page data has been cached, and
   * if so, if it was within the past half-hour.  If it was, the existing
   * home page data can be used and it doesn't need to be reloaded.
   *
   * Parameters:
   *   path - the extra path data from the URI; ignored
   */
  @method loadPath(path) {
    var cachedPage = I3.cache.get("homePage");
    var halfHourAgo = new Date(new Date().getTime() - CACHE_EXPIRE_INTERVAL);
    if (cachedPage && cachedPage.loadedAt > halfHourAgo)
      self.displayHomePage(cachedPage);
    else {
      I3.ui.show("homeLoading");
      I3.client.getObject("/home/data/home-page", self.onHomePageResponse);
    }
  }

  /**
   * Method: onHomePageResponse
   *
   * Called when the home page info has been retrieved from the server.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onHomePageResponse(response) {
    if (response.isOK()) {
      var homePage = response.getObject();
      homePage.loadedAt = new Date();
      I3.cache.set("homePage", homePage);
      self.displayHomePage(homePage);
    }
    I3.ui.hide("homeLoading");
  }
 
  /**
   * Method: displayHomePage
   *
   * Displays the home page data structure retrieved from the server.
   *
   * Parameters:
   *   homePage - the home page data, containing `news` and `weather` sections
   */
  @method displayHomePage(homePage) {
    _newsDates = [];
    _weatherDates = [];
    self.displayLinkList(homePage.link_list);
    self.displayTip(homePage.tip);
    self.displayNews(homePage.news);
    self.displayWeather(homePage.weather);
    self.setupCustomizeLink();
    setTimeout(self.updateDates, DATE_UPDATE_INTERVAL);
  }

  /**
   * Method: displayLinkList
   *
   * Displays the list of links on the left-hand side of the page.
   * 
   * Parameters:
   *   list - the array of sections to display
   */
  @method displayLinkList(list) {
    var sidebarDiv = I3.ui.get("homeLinkListContent");
    var i, j, section, link, linkPath;
    var iconImage, headerElement, listElement, itemElement, linkElement;
    for (i = 0; i < list.length; i++) {
      section = list[i];
      
      // Create icon.
      iconImage = I3.ui.create("img");
      iconImage.width = 32;
      iconImage.height = 32;
      iconImage.src = section.icon;
      iconImage.className = "homeImage";
      
      // Create header.
      headerElement = I3.ui.create("h4");
      headerElement.appendChild(I3.ui.text(section.section));
      
      // Create list.
      listElement = I3.ui.create("ul");
      for (j = 0; j < section.links.length; j++) {
        link = section.links[j];
        if (link.tool) {
          linkPath = "/" + link.tool + "/";
          if (link.path) linkPath += link.path;
          linkElement = I3.ui.createNavigationLink(link.caption, linkPath);
        } else {
          linkElement = I3.ui.create("a");
          linkElement.href = link.uri;
          linkElement.appendChild(I3.ui.text(link.caption));
        } // end if
        itemElement = I3.ui.create("li");
        itemElement.appendChild(linkElement);
        listElement.appendChild(itemElement);
      } // end for
      
      // Add the icon to the sidebar.
      if (section.tool && section.tool.length > 0)
        sidebarDiv.appendChild(I3.ui.createNavigationLink(iconImage, "/" + section.tool + "/"));
      else sidebarDiv.appendChild(iconImage);
      
      // Add the header and the list to the sidebar.
      sidebarDiv.appendChild(headerElement);
      sidebarDiv.appendChild(listElement);
    } // end for

    // Display the customize link now that the sidebar has been built.
    I3.ui.show("homeCustomize");
  } // end function

  /**
   * Method: displayTip
   *
   * Displays the Tip of the Day.
   *
   * Parameters:
   *   tipText - the string to display
   */
  @method displayTip(tipText) {

    // The tip of the day will show up as an item in the news section.
    // First build the header.
    var h4 = I3.ui.create("h4");
    h4.appendChild(I3.ui.text("Did You Know?"));

    // Next build the section containing the text.
    var div = I3.ui.create("div");
    div.className = "homeNewsSection";
    div.innerHTML = tipText.replace(/\n\n/g, "<br><br>");

    // Now add them to the page.
    var newsDiv = I3.ui.get("homeNewsContent");
    newsDiv.appendChild(h4);
    newsDiv.appendChild(div);

  } // end function

  /**
   * Method: displayNews
   *
   * Displays the news headlines.
   *
   * Parameters:
   *   newsTopics - an array of news topics to display
   */
  @method displayNews(newsTopics) {

    // Create sections for each news topic.
    var newsDiv = I3.ui.get("homeNewsContent");
    var i, j, h4, div, articles, ul, li, link, span, author, dateSpan,
        commentStr;
    for (i = 0; i < newsTopics.length; i++) {

      // Build the header for the section.
      h4 = I3.ui.create("h4");
      h4.appendChild(I3.ui.text(newsTopics[i].name));

      // Build the DIV and UL that will contain the headlines.
      div = I3.ui.create("div");
      div.className = "homeNewsSection";
      articles = newsTopics[i].articles;
      ul = I3.ui.create("ul");

      // Create links for each article, with a byline beneath each
      // one showing the author and the comment count.
      for (j = 0; j < articles.length; j++) {
        li = I3.ui.create("li");
        if (newsTopics[i].is_external) {
          // Link is to an external article with a normal URI
          link = I3.ui.create("a");
          link.href = articles[j].uri;
          link.appendChild(I3.ui.text(articles[j].subject));
        } else {
          // Link is to an i3 bulletin board post; we need to replace
          // the web service path with the applet path
          link = I3.ui.createNavigationLink(
            articles[j].subject, articles[j].uri.replace(
              "/bboard/data/messages/", "/bboard/topics/"));
        }
        author = articles[j].author ? articles[j].author : "";
        dateSpan = I3.ui.create("span");
        dateSpan.date = new Date(articles[j].posted_at);
        dateSpan.appendChild(I3.ui.text(
          I3.util.formatFriendlyDate(dateSpan.date)));
        _newsDates.push(dateSpan);
        span = I3.ui.create("span");
        span.className = "homeNewsByline";
        span.appendChild(I3.ui.text("posted "));
        span.appendChild(dateSpan);
        if (author.length > 0) span.appendChild(I3.ui.text(" by " + author));
        if (newsTopics[i].is_external == false) {
          commentStr =
            (articles[j].comment_count == 1) ? "comment" : "comments";
          span.appendChild(I3.ui.text(
            " (" + articles[j].comment_count.toString() +
            " "  + commentStr + ")"));
        }
        li.appendChild(link);
        li.appendChild(I3.ui.create("br"));
        li.appendChild(span);
        ul.appendChild(li);
      } // end for
    
      // Add the elements to the page.
      div.appendChild(ul);
      newsDiv.appendChild(h4);
      newsDiv.appendChild(div);

    } // end for
  } // end function

  /**
   * Method: displayWeather
   *
   * Displays the weather reports.
   *
   * Parameters:
   *   weatherReports - an array of weather reports to display, one per city
   */
  @method displayWeather(weatherReports) {

    // Clear out the space in the weather DIV.
    var weatherDiv = I3.ui.get("homeWeatherContent");
    weatherDiv.innerHTML = "";

    // Check to see if any weather reports were sent.
    if (weatherReports == null || weatherReports.length == 0) {

      // No reports found.
      weatherDiv.appendChild(I3.ui.text("No cities selected."));
      I3.ui.hide("home-weatherDataCredit");
    }
    else {

      // Define days of the week.
      var weekdays = [
        "Sunday", "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday" ];
      var now = new Date();
      var today = new Date(
        now.getFullYear(), now.getMonth(), now.getDate());
      var tomorrow = new Date(today.getTime() + (1000 * 60 * 60 * 24));

      // Create entries for each weather report.
      var i, j, weather, h4, friendlyDate, dateSpan, dateline, currentHead,
        currentBody, forecastHead, ul, li, forecast, strong, date, day, high;
      for (i = 0; i < weatherReports.length; i++) {

        // Build the header for the city name.
        weather = weatherReports[i];
        h4 = I3.ui.create("h4");
        h4.appendChild(I3.ui.text(weather.city_name));

        // Build the dateline.
        friendlyDate =
          I3.util.formatFriendlyDate(new Date(weather.modified_at));
        if (friendlyDate.search(/^on /) != -1)
          friendlyDate = friendlyDate.substr(3);
        dateSpan = I3.ui.create("span");
        dateSpan.date = new Date(weather.modified_at);
        dateSpan.appendChild(I3.ui.text(friendlyDate));
        _weatherDates.push(dateSpan);
        dateline = I3.ui.create("p");
        dateline.className = "homeWeatherDateline";
        dateline.appendChild(I3.ui.text("as of "));
        dateline.appendChild(dateSpan);

        // Build the "Current conditions" header.
        currentHead = I3.ui.create("p");
        currentHead.className = "homeWeatherHead";
        currentHead.appendChild(I3.ui.text("Current conditions"));

        // Build the "Current conditions" section.
        currentBody = I3.ui.create("p");
        currentBody.className = "homeWeatherCurrentBody";
        currentBody.innerHTML =
          weather.conditions + ', ' +
          weather.temperature.toString() + '&deg;';

        // Build the "Forecast" header.
        forecastHead = I3.ui.create("p");
        forecastHead.className = "homeWeatherHead";
        forecastHead.appendChild(I3.ui.text("Forecast"));

        // Create line items for each forecast day.
        ul = I3.ui.create("ul");
        for (j = 0; j < weather.forecasts.length; j++) {
          forecast = weather.forecasts[j];
          date = self.dateFromYMD(forecast.date);
          if (date.getTime() == today.getTime()) day = "Today";
          else if (date.getTime() == tomorrow.getTime()) day = "Tomorrow";
          else day = weekdays[date.getDay()];
          li = I3.ui.create("li");
          if (forecast.high == null) high = "";
          else high = forecast.high.toString() + '&deg;/';
          li.innerHTML =
            '<strong>' + day + '</strong><br />' +
            forecast.conditions + ', ' +
            high + forecast.low + '&deg;';
          ul.appendChild(li);
        }

        // Now add everything to the weather div.
        weatherDiv.appendChild(h4);
        weatherDiv.appendChild(dateline);
        weatherDiv.appendChild(currentHead);
        weatherDiv.appendChild(currentBody);
        weatherDiv.appendChild(forecastHead);
        weatherDiv.appendChild(ul);

      } // end for
      
      I3.ui.show("home-weatherDataCredit");
    } // end if
    
  } // end function

  /**
   * Method: setupCustomizeLink
   *
   * Activates the "Customize Home Page" link.
   */
  @method setupCustomizeLink() {
    var link = I3.ui.get("homeCustomizeLink");
    I3.ui.setNavigationPath(link, "/home/customize");
  }

  /**
   * Method: updateDates
   *
   * Updates all of the friendly-formatted date fields so that
   * they're more accurate.  This is called every 5 minutes.
   */
  @method updateDates() {
    var friendlyDate = "";
    for (var i = 0; i < _newsDates.length; i++) {
      friendlyDate = I3.util.formatFriendlyDate(_newsDates[i].date);
      _newsDates[i].innerHTML = friendlyDate;
    }
    for (var i = 0; i < _weatherDates.length; i++) {
      friendlyDate = I3.util.formatFriendlyDate(_weatherDates[i].date);
      if (friendlyDate.search(/^on /) != -1)
        friendlyDate = friendlyDate.substr(3);
      _weatherDates[i].innerHTML = friendlyDate;
    }
    setTimeout(self.updateDates, DATE_UPDATE_INTERVAL);
  }

  /**
   * Method: dateFromYMD
   *
   * Returns a valid date from a "YYYY-MM-DD" string.  The time will
   * be set to midnight.
   *
   * Parameters:
   *   ymdString - the string to be parsed
   * 
   * Returns:
   *   The parsed value as a `Date` object.
   */
  @method dateFromYMD(ymdString) {
    var fields = [];
    fields[0] = ymdString.substr(0, 4);
    fields[1] = ymdString.substr(5, 2);
    fields[2] = ymdString.substr(8, 2);
    for (var i = 1; i < 3; i++) {
      // Strip off leading zeros because they confuse parseInt().
      if (fields[i].substr(0, 1) == "0") fields[i] = fields[i].substr(1);
    }
    return new Date(
      parseInt(fields[0]), parseInt(fields[1]) - 1, parseInt(fields[2]) );
  }

}
