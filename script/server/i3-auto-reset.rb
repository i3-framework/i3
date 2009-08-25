#!/usr/bin/env ruby

# 
# Helper Script: server/i3-auto-reset
#
# Automatically resets the i3 Mongrel service whenever a file in either the i3 or i3-site tree
# is changed.
# 
# Utilizes the FSEvents framework in Mac OS X "Leopard".
# 
# This tool should be run as "root" since it must call the `launchctl` command to stop the 
# i3 Mongrel service.
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
#   $Id: i3-auto-reset.rb 48 2008-01-16 15:41:56Z nmellis $
#

require "osx/foundation"
OSX.require_framework "/System/Library/Frameworks/CoreServices.framework/Frameworks/CarbonCore.framework"

require File.expand_path(File.dirname(__FILE__) + "/../../framework/intranet")

module I3AutoReset
  
  class Agent
    include I3::LoggingSupport
    
    #
    # Class Method: start
    #
    # Registers a callback with the FSEvents framework that will restart the i3 Mongrel service 
    # whenever a file is changed.
    #
    def self.start
      
      callback = proc do |stream, context, event_count, paths, marks, event_ids|
        log.debug "Restarting the i3 Mongrel service from i3-auto-reset."
        `launchctl stop org.maf.intranet.mongrel`
      end #proc
      
      begin
        @stream = OSX::FSEventStreamCreate(OSX::KCFAllocatorDefault, callback, nil, 
                    [I3::ROOT_PATH, I3::SITE_PATH, "#{I3::LOCAL_PATH}/config"], 
                    OSX::KFSEventStreamEventIdSinceNow, 1.0, 0)
      
        unless @stream
          log.error "Failed to create FSEvent stream."
          exit
        end
      
        OSX::FSEventStreamScheduleWithRunLoop(
          @stream, OSX::CFRunLoopGetCurrent(), OSX::KCFRunLoopDefaultMode)
        unless OSX::FSEventStreamStart(@stream)
          log.error "Failed to start FSEvent stream."
          exit
        end
      
        log.debug "i3-auto-reset is watching for changes."
        OSX::CFRunLoopRun()
      rescue Interrupt
        OSX::FSEventStreamStop(@stream)
        OSX::FSEventStreamInvalidate(@stream)
        OSX::FSEventStreamRelease(@stream)
        log.debug "i3-auto-reset has stopped."
      end #begin
    end #self.start
    
  end #class Agent
  
  def self.main(args)
    Agent.start
  end #self.main
  
end #module I3AutoReset

I3AutoReset.main(ARGV) if __FILE__ == $0