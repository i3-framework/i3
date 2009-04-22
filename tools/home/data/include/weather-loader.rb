#
# File: home/data/include/weather-loader
#
# This defines the <Home::WeatherLoader> class, which provides access to the
# weather reports at accuweather.com.
#
# Credits:
# 
#   Written by:
#     Marshall Elfstrand (marshall@vengefulcow.com) and
#     Nathan Mellis (nathan@mellis.us).
# 
# Copyright / License:
# 
#   Copyright 2009 Mission Aviation Fellowship
# 
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#
# Version:
#   $Id: weather-loader.rb 116 2008-07-17 15:58:38Z nmellis $
#

require "cgi"                                   # CGI support
require "net/http"                              # HTTP protocol support
require "time"                                  # Time class extensions
require "rexml/document"                        # XML support

require 'home/data/model/weather'               # Weather database model

#
# Module: Home
#
# The module containing all Home Page classes and data.
# 
module Home
  
  #
  # Class: Home::WeatherLocationNotFound
  #
  # Custom exception that is raised when a weather location is not found.
  #
  class WeatherLocationNotFound < I3::NotFoundException
    set_default_title   "Weather location not found"
    set_default_message "The requested weather location could not be found."
  end #class WeatherLocationNotFound

  #
  # Class: Home::WeatherLoader
  # 
  # Refreshes weather reports.
  #
  class WeatherLoader
    include I3::LoggingSupport
  
    # Accu-Weather.com API addresses
    FORECAST_URI = I3.config.tools["home"].settings.weather_api.weather_data
    LOOKUP_URI   = I3.config.tools["home"].settings.weather_api.city_lookup

    #
    # Method: refresh_all
    # 
    # Refreshes all weather reports.
    #
    def refresh_all
      success_count = 0
      error_count = 0
      Home::WeatherReport.find(:all).each do |report|
        code = report.city_code
        begin
          refresh_report(report)
          success_count += 1
        rescue Timeout::Error
          log.error "Error refreshing weather for '#{code}': Timed out"
          error_count += 1
        rescue WeatherLocationNotFound
          log.error "Weather location '#{code}' could not be found: #{$!.message}"
          error_count += 1
        rescue
          log.error "Error refreshing weather for '#{code}': #{$!}"
          error_count += 1
        end
      end #each
      if error_count > 0
        STDERR.puts "*** #{error_count} errors occurred while refreshing " +
                    "the weather data."
        STDERR.puts "See the intranet log for details."
      end #if
      log.info "#{success_count} weather reports were updated successfully."
    end #def
  
    #
    # Method: refresh_report
    # 
    # Refreshes a single weather report.
    #
    # Parameters:
    #   report - the <WeatherReport> object into which the data will be loaded
    #
    def refresh_report(report)
      if FORECAST_URI.nil?
        log.warn "No weather API has been configured in your tool settings."
        return
      end
      
      city_code = report.city_code
      
      # Read the current conditions data from the web site.
      response = Net::HTTP.get_response(URI.parse(FORECAST_URI + CGI.escape(city_code)))
      xml = REXML::Document.new(response.body).root
      
      # If there were any failures, then report them
      if xml.elements["failure"]
        raise WeatherLocationNotFound.new(:message => xml.elements["failure"].text)
      end
      
      units    = xml.elements["units"]
      local    = xml.elements["local"]
      current  = xml.elements["currentconditions"]
      forecast = xml.elements["forecast"]      
    
      # Fill in the fields of the report object.
      report.modified_at   = Time.now.utc
      report.city_name     = local.elements["city"].text + ", " + local.elements["state"].text
      report.conditions    = current.elements["weathertext"].text
      report.temperature   = current.elements["temperature"].text
      report.feels_like    = current.elements["realfeel"].text
      report.humidity      = current.elements["humidity"].text
      report.pressure      = current.elements["pressure"].text
      report.dew_point     = current.elements["dewpoint"].text
      report.visibility    = current.elements["visibility"].text
      report.uv_index      = current.elements["uvindex"].attributes["index"] + " " + 
                             current.elements["uvindex"].text
      report.wind          = "From " + current.elements["winddirection"].text + " at " + 
                             current.elements["windspeed"].text + " " + units.elements["speed"].text
      report.save
      

      # Create a new set of weather forecasts.
      report.forecasts.clear
      forecast.elements.each("day") do |day|
        
        daytime   = day.elements["daytime"]
        nighttime = day.elements["nighttime"]
        
        # Fill in the fields of the forecast object.
        new_fc                         = Home::WeatherForecast.new
        new_fc.date                    = day.elements["obsdate"].text
        new_fc.conditions              = daytime.elements["txtshort"].text
        new_fc.high                    = daytime.elements["hightemperature"].text
        new_fc.low                     = daytime.elements["lowtemperature"].text
        new_fc.chance_of_precipitation = daytime.elements["tstormprob"].text.ljust(2, "0")
        report.forecasts << new_fc
      end #each
      
    end #def

    #
    # Method: lookup_city_code
    # 
    # Looks up the given `city_name` and returns a list of city objects.
    # Each object in the result is a `Hash`, with "code" and "name" keys
    # representing the weather.com city code and the city name, respectively.
    # 
    # Parameters:
    #   city_name - the name of the city to look up
    # 
    # Returns:
    #   An `Array` of `Hash` objects, each with "code" and "name" keys.
    #
    def lookup_city_code(city_name)
      if LOOKUP_URI.nil?
        log.warn "No weather API has been configured in your tool settings."
        return []
      end
      
      # Make a request to the weather.com search facility.
      uri = LOOKUP_URI + CGI.escape(city_name)
      response = Net::HTTP.get_response(URI.parse(uri))

      case response
        when Net::HTTPOK
          xml = REXML::Document.new(response.body).root
          
          cities = []
          xml.elements.each("citylist/location") do |city|
            cities << { 
              "code" => city.attributes["location"], 
              "name" => "#{city.attributes["city"]}, #{city.attributes["state"]}" 
            }
          end #each
          
          return cities
        else
          return []
      end #case
      
    end #lookup_city_code

  end #class

end #module
