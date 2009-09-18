#
# File: common/data/include/suggestion
#
# Provides a base class for servlets that return suggestions.
# 
# The <I3.AutocompleteView> class in the JavaScript client framework provides
# a drop-down list of suggested completions as the user types into a text
# field.  These suggestions are provided by a data model class, which can
# be either custom-written or one of the supplied pre-built models.
# 
# One of the pre-built classes is <I3.WebServiceAutocompleteModel>, which
# contacts a web service, provides it with the string, and waits for a
# result.  The web service that it contacts is expected to be a subclass
# of the <I3::SuggestionServlet> class provided in this file.
# 
# Suggestion servlets need only implement one method, called `match`,
# which takes a string to match (along with an optional path) and returns
# an array of results.  Each result is an instance of <I3::Suggestion>.
# For example:
# 
# (start example)
#   class MovieSuggestionServlet < I3::SuggestionServlet
#     def match(str, path=nil)
#       movies = Movie.find(:all, :conditions => ["name LIKE ?", str + "%"])
#       movies.collect { |m| I3::Suggestion.new(m.name) }
#     end #def
#   end #class
# (end example)
# 
# Each suggestion has a `text` value and an optional `alt` value.
# The `alt` value can be used to provide additional information to help
# the user discern between two similar matches, or to provide the client
# code with additional data about the match.
# 
# Credits:
# 
#   Written by
#     Nathan Mellis (nathan@mellis.us) and
#     Marshall Elfstrand (marshall@vengefulcow.com).
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
#   $Id: suggestion.rb 2 2007-12-06 00:18:23Z melfstrand $
#

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Class: I3::SuggestionServlet
  #
  # Base class for servlets that provide auto-complete suggestions
  # to the client.
  #
  class SuggestionServlet < I3::Servlet
    
    #
    # Method: on_get
    #
    # Calls the <match> method and sends the results to the client.
    # The client is expected to have provided a CGI parameter called
    # "q" that contains the string to match.
    #
    # Parameters:
    #   path - additional path data provided in the URI; this is forwarded
    #     to the `match` method for optional use
    #
    def on_get(path)
      match_string = CGI.unescape(I3.server.cgi["q"])
      # TODO - return a message if the match string is empty
      I3.server.send_object(self.match(match_string, path))
    end #on_get
    
    #
    # Method: match
    #
    # Examines a match string and returns an array of suggested completions.
    # Subclasses are expected to override this method to provide their own
    # implementation.  The default implementation returns an empty array.
    # 
    # Parameters:
    #   str - the string to be auto-completed, provided by the client
    #   path - optional; additional path data provided in the URI
    # 
    # Returns:
    #   An `Array` of <I3::Suggestion> objects that are possible completions
    #   for the given string.
    #
    def match(str, path=nil)
      []
    end #match
    
  end #class SuggestionServlet

  # ==========================================================================
  
  #
  # Class: I3::Suggestion
  #
  # Represents a suggested auto-completion.  The <I3::SuggestionServlet::match>
  # returns an array of these, one for each suggestion.
  #
  class Suggestion
    
    # Property: text
    # The suggested auto-complete text.
    # Read-only.
    attr_reader :text
    
    # Property: alt
    # An optional alternate value that may be of use to the client.
    # Read-only.
    attr_reader :alt

    #
    # Constructor: new
    # 
    # Initializes a `Suggestion` instance.
    # 
    # Parameters:
    #   text - the suggested auto-complete text
    #   alt - optional; an alternate value that may be of use to the client
    #
    def initialize(text, alt=nil)
      @text = text
      @alt = alt
    end #initialize
    
    #
    # Method: to_json
    #
    # Encodes the suggestion in JSON format for sending to the client.
    #
    # Returns:
    #   The JSON string representing the object.
    #
    def to_json(options = nil)
      { :text => self.text, :alt => self.alt }.to_json(options)
    end #to_json
    
  end #class Suggestion

end #module I3