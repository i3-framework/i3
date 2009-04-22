#
# File: framework/intranet/logging
#
# Provides access to the shared intranet log file.  This includes the
# `I3.log` attribute, the custom <I3::MiniLogger> class, and a mix-in
# module called <I3::LoggingSupport> for easily adding a `log` attribute
# to other classes.
#
# The `I3.log` attribute provides access to a shared logger.  The logger
# is assigned during startup of the server process.  Messages sent to the
# shared logger should use the form:
#
# >  I3.log.info("ModuleName::ClassName") { "Your message here." }
#
# The `debug`, `warn`, `error`, and `fatal` methods can also be used, but
# they all should follow the above format.
#
# It may seem a bit tedious to have to supply the module and class name
# every time for something as frequently used as logging, and it is.
# Thankfully, the <I3::MiniLogger> class and <I3::LoggingSupport> module
# make this rather easier to work with.
#
# The <I3::MiniLogger> class provides a similar interface to Ruby's `Logger`,
# but automatically fills in the module/class name and forwards the message
# to the shared I3 logger.  Including the <I3::LoggingSupport> module in a
# class automatically sets up an <I3::MiniLogger> attribute called `log`.
# So the above line of code becomes:
#
# >  log.info "Your message here."
#
# To make use of this, simply include <I3::LoggingSupport> when defining
# a class:
#
# (start example)
#   #
#   # Class: TimeTraveler
#   # An amazing futuristic class that only requires Ruby and a DeLorean.
#   #
#   class TimeTraveler
#     include I3::LoggingSupport
#   
#     #
#     # Method: travel_to
#     # Travel back in time to the given `historic_event`.
#     #
#     def travel_to(historic_event)
#       log.warn "Not yet implemented.  Need flux capacitor first."
#     end #def
#
#   end #class
# (end example)
#
# For convenience, <I3::LoggingSupport> is already included in any
# <I3::Servlet> and <I3::Record> subclasses that you write.
#
# Credits:
# 
#   Written by Marshall Elfstrand (marshall@vengefulcow.com).
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
#   $Id: logging.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require 'logger'    # Ruby logger class

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3

  # Constant: LOG_FILE_PATH
  # The path to the intranet log file.
  LOG_FILE_PATH = I3::LOCAL_PATH + "/logs/intranet.log"

  # Mutex used to synchronize code that accesses the shared logger.
  LOG_MUTEX = Mutex.new

  #
  # Clas (Hidden): I3::CustomLogger
  #
  # Logger class that restores the formatting provided by the Ruby `Logger`,
  # which Rails (stupidly) breaks.  Use as you would the Ruby `Logger` class.
  #
  class CustomLogger < Logger
    
    #
    # Constant (Hidden): DEFAULT_FORMAT
    # The log format to use if <log_format> has not been set.
    #
    DEFAULT_FORMAT = "%s, [%s#%d] %5s -- %s: %s\n"

    #
    # Property (Hidden): log_format
    #
    # The log format to use.  Read/write.  This needs to be a `printf` style
    # format string that has six placeholders:
    #
    #   1. the first letter of the severity (e.g. "W" for "WARN")
    #   2. the timestamp string
    #   3. the process ID of the intranet server
    #   4. the severity (e.g. "ERROR")
    #   5. the name of the program (e.g. "I3::ServerApp")
    #   6. the message text
    #
    # The log format should end in a newline.
    #
    attr_accessor :log_format
    
    #
    # Method (Hidden): format_message
    #
    # Applies the <log_format> to the given message.
    #
    # Parameters:
    #   severity - the severity of the message (e.g. "DEBUG")
    #   timestamp - an already-formatted timestamp string
    #   progname - the full name of the class logging the message
    #     e.g. ("I3::Account")
    #   msg - the message to be logged
    #
    # This is not called directly by any of the API code; it fixes
    # an issue with the Rails implementation of the `Logger` class.
    #
    def format_message(severity, timestamp, progname, msg)
      @log_format = DEFAULT_FORMAT if @log_format.nil?
      @log_format % [severity[0..0], timestamp, $$, severity, progname, msg]
    end    

  end #class

  #
  # Class: I3::MiniLogger
  #
  # Logger class meant for inclusion via the <I3::LoggingSupport> module.
  # See the file overview for details.
  #
  class MiniLogger
  
    #
    # Constructor: new
    #
    # Returns a new logger with the given `application_name`.  Messages
    # logged using this logger will contain the application name before the
    # message.
    #
    def initialize(application_name)
      @appname = application_name
    end #def
    
    #
    # Method: debug
    #
    # Logs a debugging message using the shared I3 logger.
    #
    # Parameters:
    #   message - the string to write to the log file
    #
    def debug(message)
      begin
        I3::log.debug(@appname) { message }
      rescue
        STDERR.puts("Error logging DEBUG: %s (%s)" % [message, $!.to_s])
      end
    end #debug

    #
    # Method: info
    #
    # Logs an informational message using the shared I3 logger.
    #
    # Parameters:
    #   message - the string to write to the log file
    #
    def info(message)
      begin
        I3::log.info(@appname) { message }
      rescue
        STDERR.puts("Error logging INFO: %s (%s)" % [message, $!.to_s])
      end
    end #def

    #
    # Method: warn
    #
    # Logs a warning message using the shared I3 logger.
    #
    # Parameters:
    #   message - the string to write to the log file
    #
    def warn(message)
      begin
        I3::log.warn(@appname) { message }
      rescue
        STDERR.puts("Error logging WARN: %s (%s)" % [message, $!.to_s])
      end
    end #def

    #
    # Method: error
    #
    # Logs an error message using the shared I3 logger.
    #
    # Parameters:
    #   message - the string to write to the log file
    #
    def error(message)
      begin
        I3::log.error(@appname) { message }
      rescue
        STDERR.puts("Error logging ERROR: %s (%s)" % [message, $!.to_s])
      end
    end #def

    #
    # Method: fatal
    #
    # Logs a fatal error message using the shared I3 logger.
    #
    # Parameters:
    #   message - the string to write to the log file
    #
    def fatal(message)
      begin
        I3::log.fatal(@appname) { message }
      rescue
        STDERR.puts("Error logging FATAL: %s (%s)" % [message, $!.to_s])
      end
    end #def

  end #class
  
  
  #
  # Module: I3::LoggingSupport
  #
  # Module to be included in classes to enable quick access to `log`
  # attribute.
  #
  module LoggingSupport

    #
    # Property: log
    # The <I3::MiniLogger> for the instance.  Read only.
    #
    def log
      @_i3_mini_log = MiniLogger.new(self.class.name) if @_i3_mini_log.nil?
      return @_i3_mini_log
    end #def
    
    #
    # Private Class Method: included
    #
    # Creates a method that returns an <I3::MiniLogger> for the class itself.
    # This is called automatically whenever this module is included in
    # another class.
    #
    def self.included(c)
      def c.log
        @_i3_mini_log = MiniLogger.new(self.name) if @_i3_mini_log.nil?
        return @_i3_mini_log
      end #def
    end #def

  end #module


  # -------------------------------------------------------------------------
  # Section: I3 module extensions
  # -------------------------------------------------------------------------

  #
  # Property: log
  #
  # The shared instance of the intranet logger.  Read/write.
  # This is generally set only once, by the server bootstrap code.
  #
  def self.log
    log_instance = nil
    LOG_MUTEX.synchronize do
      if @_log.nil?
        @_log = CustomLogger.new(LOG_FILE_PATH, 'weekly')
        @_log.datetime_format = "%a %Y-%m-%d %H:%M:%S %Z "
        @_log.level = case I3.config.log_level
          when :fatal : Logger::FATAL
          when :error : Logger::ERROR
          when :warn  : Logger::WARN
          when :info  : Logger::INFO
          else          Logger::DEBUG
        end #case
      end #if
      log_instance = @_log
    end #synchronize
    return log_instance
  end #def
  
  def self.log=(value)
    LOG_MUTEX.synchronize { @_log = value }
  end #def

end #module
