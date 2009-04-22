#
# Web Service: common/data/suggestions
#
# Provides access to autocompletion for common intranet-wide data such as people's names and 
# email addresses.  Inherits from <I3::SuggestionServlet> which will provide the basic structure.
#
# Credits:
# 
#   Written by Nathan Mellis (nathan@mellis.us).
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
#   $Id: suggestions.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "common/data/include/suggestion"      # Suggestion servlet base class

#
# Module: I3
#
# The module containing all Intranet classes and data.
#
module I3

  #
  # Class: I3::CommonSuggestionServlet
  #
  # Inherits from <I3::SuggestionServlet> to provide the basic structure for the web service.  
  # Must implement a <match> method which will take a string and path argument.  The `path` 
  # is the additional path elements that were passed to the web service so you know what data 
  # needs to be matched and the string (`str`) is the string to match.
  # 
  # It should return an <I3::Suggestion> object which contains the autocompletion choices and 
  # an optional alternate value (such as an email address for a person's name).
  # 
  # This servlet will allow for grabbing autocompletion choices for people in the `people` table 
  # either by their name or by their email address.
  # 
  # Usage
  # =====
  # 
  # To get a list of possible people's names for string 'joe', you would call the web service in 
  # the following way:
  # 
  #   `GET /common/data/suggestions/people/by-name?q=joe`
  # 
  # To get a list of possible people's email addresses for string 'jdoe', you would similarly call 
  # the web service in the following way:
  # 
  #   `GET /common/data/suggestions/people/by-email?q=jdoe`
  # 
  # The <match> method should return an <I3::Suggestion> object.
  # 
  # Example:
  # (start example)
  # def match(str, path=nil)
  #   # Find the matches
  #   search = ...
  #   return search.collect { |result| I3::Suggestion.new(result.full_name, result.email ) }
  # end
  # (end example)
  # 
  # See Also:
  #   <I3::SuggestionServlet>, 
  #   <I3::Suggestion>
  #
  class CommonSuggestionServlet < I3::SuggestionServlet
    
    #
    # Method: match
    # 
    # Implements the `match` method for <I3::SuggestionServlet>.
    # 
    # Parameters:
    #   str - a string to match records against
    #   path - the additional path info given to the web service
    # 
    # Returns:
    #   An array of <I3::Suggestion> objects.
    # 
    # See Also:
    #   <I3::Suggestion>, 
    #   <I3::SuggestionServlet>
    # 
    def match(str, path=nil)
      path = path[1..-1] if path.starts_with? "/"
      path = path.split("/")
      
      case path[0]
      when "people"
        case path[1]
        when "by-name"
          begin
            search = I3::Person.find(:all, :conditions => 
              "CONCAT(first_name, ' ', last_name) " + "LIKE '#{str}%'")
            search.sort! { |a,b| a.first_name.to_s <=> b.first_name.to_s }
            return search.collect { |person| 
              I3::Suggestion.new(person.full_name, person.email) }
          rescue
            log.error $!.backtrace
          end #begin
          
        when "by-email"
          begin
            search = I3::EmailAddress.find(:all, :conditions => 
              "CONCAT(user, '@', host) " + "LIKE '#{str}%'")
            search.sort! { |a,b| a.to_s <=> b.to_s }
            return search.collect { |address| 
              I3::Suggestion.new(address.to_s, address.person.full_name) }
          rescue
            log.error $!.backtrace
          end #begin
          
        end #case
      end #case
    end #match

  end #class

end #module
