#
# File: framework/intranet/exception
#
# Extends the Exception class for use in <I3.server.send_error>.
# 
# It provides a standard <I3::ServerException> class that will provide a 
# basic "500 Internal Server Error" by default but can be overridden to 
# send other messages.
# 
# There are also two subclasses that provide easier access to some of the 
# more frequent errors.  <I3::NotFoundException> will send a "404 Not Found"
# HTTP status, and <I3::SecurityException> will send a "403 Forbidden" HTTP
# status.  All classes may have their `title`, `message`, and `help` strings
# overridden.
# 
# *Usage*
# 
# When instantiating a server exception object, a `Hash` of options may
# be supplied.  The following keys are supported:
# 
#   * `:status` - the HTTP status to send to the client.  The most
#       frequently used status messages are "404 Not Found" (when
#       the path is not valid) and "403 Forbidden" (when the user
#       does not have permission), but it can be any applicable HTTP
#       status; see <I3::ServerApp::send_header> for a list of some
#       other status codes.
#   * `:title` - the title for the error, such as "Access Denied"
#   * `:message` - a brief but user-friendly description of the error
#   * `:help` - further explanation of why the error occurred and/or what
#       the user might do about it; optional but recommended
#   * `:headers` - optional; a `Hash` of additional HTTP headers to send
#       in the response.  See <I3::ServerApp::send_header> for more details.
# 
# These options are supported for both the base `ServerException` object
# and any subclasses.  For example:
# (start example)
# 
#   # 500 Internal Server Error -- avoid if at all possible
#   I3.server.send_error(I3::ServerException.new)
# 
#   # 404 Not Found
#   I3.server.send_error(I3::NotFoundException.new(
#     :message => "The stone could not be found in the vault.", 
#     :help => "Try looking in an underground mirror."))
# 
#   # 403 Forbidden
#   I3.server.send_error(I3::SecurityException.new(
#     :title => "Naughty Naughty!", 
#     :message => "You are not permitted to take anything but the lamp.", 
#     :help => "The cavern is collapsing.  There is no help for you now."))
# 
# (end example)
# 
# *Subclassing*
# 
# New subclasses should inherit from <I3::ServerException>.
# The default strings for the `status`, `title`, and `message` attributes
# can be overridden by calling `set_default_xxx` where "xxx" is the field
# name.  For example:
# 
# (start example)
#   class GoneException < ServerException
#     set_default_status  "410 Gone"
#     set_default_title   "Resource Removed"
#     set_default_message "The requested resource has been removed."
#   end
# (end example)
#
# Credits:
# 
#   Written by
#     Nathan Mellis (nathan@mellis.us) and
#     Marshall Elfstrand (marshall@vengefulcow.com)
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
#   $Id: exception.rb 62 2008-03-17 18:58:33Z nmellis $
#


#
# Module: I3
#
module I3
  
  #
  # Class: I3::ServerException
  #
  # The base class for i3 server exceptions.
  # 
  # See file documentation for usage details.
  #
  class ServerException < RuntimeError
    
    attr_reader :status, :title, :message, :help

    overridable_cattr_accessor :default_status
    overridable_cattr_accessor :default_title
    overridable_cattr_accessor :default_message
    overridable_cattr_accessor :default_help

    set_default_status  "500 Internal Server Error"
    set_default_title   "Server Error"
    set_default_message "An unexpected server error has occurred."
    set_default_help    "Please contact the Help Desk."
    
    #
    # Method: initialize
    #
    # Initializes a new `ServerException` instance.  As hash
    # of values can be provided to customize the exception.
    #
    # Parameters:
    #   options - a Hash that contains the following keys:
    #               :status, :title, :message, :help
    #
    def initialize(options={})
      options = {} if options.nil?
      options = { :message => options.message } if options.is_a? Exception
      
      options = { :message => options } if options.is_a? String
      @headers = Hash.new
      @headers.merge! options.delete(:headers) || {}
      @status  = options[:status]  || default_status
      @title   = options[:title]   || default_title
      @message = options[:message] || default_message
      @help    = options[:help]    || default_help
    end #initialize
    
    #
    # Method: headers
    #
    # Returns the array of custom headers to send to the client
    # for this exception.
    #
    def headers
      @headers.merge({ "Status" => @status })
    end #headers
    
    #
    # Method: status_code
    #
    # Returns the numeric HTTP status code for the exception.
    #
    def status_code
      self.status.to_i
    end #def
    
    #
    # Method: to_s
    #
    # Provides a string representation of the error, consisting of
    # the status, title, message, and help text on separate lines.
    #
    def to_s
      return "\nStatus:\t\t#{@status}\nTitle:\t\t#{@title}\n" + 
      "Message:\t#{@message}\nHelp:\t\t#{@help}"
    end #to_s
    
    #
    # Method: to_shared
    #
    # Returns the Exception object as an <I3::SharedObject> containing
    # `title`, `message`, and `help` attributes.
    #
    def to_shared(options={})
      response = I3::SharedObject.new
      response.status  = self.status
      response.title   = self.title
      response.message = self.message
      response.help    = self.help
      return response
    end #to_shared
    
  end #class ServerException

  
  #
  # Class: I3::NotFoundException
  #
  # A subclass of <I3::ServerException> to be used for 404 errors.
  #
  class NotFoundException < ServerException
    set_default_status  "404 Not Found"
    set_default_title   "Resource Not Found"
    set_default_message "The requested resource could not be found."
  end #class NotFoundException

  
  #
  # Class: I3::SecurityException
  #
  # A subclass of <I3::ServerException> to be used for 403 errors.
  #
  class SecurityException < ServerException
    set_default_status  "403 Forbidden"
    set_default_title   "Access Denied"
    set_default_message "You do not have permission to access this resource."
  end #class SecurityException
  
end #module I3