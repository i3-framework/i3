#!/usr/bin/env ruby

#
# Helper Script: server/i3-jobs
#
# Runs the automated jobs that have been defined by each tool.
# 
# Each tool has a `meta` folder that contains files that the i3 framework
# knows to check for.  One of the files that may optionally be provided by
# a tool author is `jobs.rb`, which is used to define blocks of code that
# should execute on a regular basis, independent of intranet requests.
# These may be used to cache files, remove old temporary files, sync data
# with another server, or any number of other operations.
# 
# The layout of the `jobs.rb` file is very simple.  Each block of code
# that should run periodically is prefixed with an `every_xxx` method,
# where _xxx_ is a unit of time.  Examples probably show it best:
# (start example)
# 
#   every_hour do
#     Home::WeatherLoader.new.refresh_all
#   end
# 
#   every_day do
#     I3.cache["summary"] = Contacts::Summary.new
#   end
# 
#   every_monday_at_0800 do
#     Tickets::Mailer.send_weekly_open_tickets_notice
#   end
# 
# (end example)
# Of course, the `jobs.rb` script will need to `require` any supporting
# files it needs.
# 
# The supported units of time are `hour`, `day`, `week`, and `month`, in
# addition to the days of the week.  Notice also that you can specify an
# `at` suffix with a time in military format to have the job execute at
# a specific time.  When no time is specified for a day, midnight is assumed.
# When `every_week` is specified, midnight on Monday morning is assumed.
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
#   $Id: i3-jobs.rb 60 2008-03-10 14:46:57Z nmellis $
#

require File.dirname(__FILE__) + "/../include/script-common"

# ----------------------------------------------------------------------------

#
# Module: I3AutomatedJobs
# 
# The module containing the classes for the automated job processor,
# including command-line processing.
# 
module I3AutomatedJobs

  # Constant: SUPPORTED_FREQUENCIES
  # The list of supported intervals that can be used in method names.
  SUPPORTED_FREQUENCIES = [
      :hour, :day, :weekday, :week, :month,
      :sunday, :monday, :tuesday, :wednesday, :thursday, :friday, :saturday
  ]

  #
  # Class: I3AutomatedJobs::JobCalendar
  # 
  # Manages the calendar of scheduled events.  Jobs are scheduled at
  # intervals using <schedule_job>, and then <process_jobs> is called
  # to start the 
  # 
  class JobCalendar
    include I3::LoggingSupport

    # Property: current_source
    # The file from which jobs are currently being read.
    # This is referenced by <schedule_job> to provide each job
    # with information about where it was defined.
    attr_accessor :current_source
    
    #
    # Private Constructor: new
    # 
    # Sets up the job calendar.  Do not instantiate directly; use
    # <I3AutomatedJobs.calendar> to get the shared instance of the
    # calendar object.
    # 
    def initialize
      @events = []
      @should_stop = false
    end #def

    #
    # Method: schedule_job
    # 
    # Adds a job to the calendar.  This is called by the `method_missing`
    # handler that parses the method name and extracts the frequency, time,
    # and block of code from it.
    # 
    # Parameters:
    #   frequency - a `Symbol` that tells how often to run the job;
    #     must be one of the items in <I3AutomatedJobs::SUPPORTED_FREQUENCIES>
    #   time - optional; a four-digit string telling the specific time
    #     at which to run the job
    #   block - the block of code to execute
    # 
    def schedule_job(block, frequency, time=nil)
      job = Job.new(self.current_source, block, frequency, time)
      @events << job
    end #def
    
    #
    # Method: sort!
    # 
    # Sorts the jobs in the calendar by their `next_run` time.
    # 
    def sort!
      @events.sort! { |job1, job2| job1.next_run <=> job2.next_run }
    end #def

    #
    # Method: process_jobs
    # 
    # Begins processing the scheduled jobs.  This method will continue
    # running until `stop_processing` is called.
    # 
    # Returns:
    #   `true` if processing stopped normally via <stop_processing>,
    #   `false` if no jobs were found to process.
    # 
    def process_jobs

      # Write summary to the debug log.
      self.sort!
      job_summary = @events.inject("") do |str, e|
        str + "  - #{e.next_run}  (#{e.defined_in})\n"
      end #inject
      log.info("Scheduled jobs:\n" + job_summary)
      
      # Begin endless loop through schedule.
      while @events.size > 0

        # Run all jobs whose time has arrived.
        # Processing a job resets its next_run time, so when the
        # event list is re-sorted, the next scheduled event will
        # become the first in the list.
        while @events[0].next_run < Time.now
          log.info "Processing job from %s" % @events[0].defined_in
          @events[0].process!
          log.info "Finished processing job from %s" % @events[0].defined_in
          self.sort!
        end #while
        return true if @should_stop
        
        # Sleep until next event is supposed to occur.
        # An extra second is added to make sure we get beyond the time,
        # and we make sure the delay is non-negative so that we don't
        # get an exception from Kernel#sleep.
        delay = [@events[0].next_run - Time.now + 1, 0].max
        remaining_hours   = (delay / 1.hour).to_i
        remaining_minutes = (delay % 1.hour / 1.minute).to_i
        remaining_seconds = (delay % 1.minute).to_i
        log.info "Next job in %d hour%s, %d minute%s, %d second%s" % [
              remaining_hours,   (remaining_hours   == 1 ? "" : "s"),
              remaining_minutes, (remaining_minutes == 1 ? "" : "s"),
              remaining_seconds, (remaining_seconds == 1 ? "" : "s") ]
        sleep([ @events[0].next_run - Time.now + 1, 0 ].max)
        return true if @should_stop
      end #while

      return false  # We only get here if there are no jobs
    end #def
    
    #
    # Method: stop_processing
    # 
    # Cleanly stops the processing of jobs.  Any running jobs
    # will be allowed to finish processing before the process exits.
    # 
    def stop_processing
      # The loop in `process_jobs` checks this variable to see if
      # it should stop processing.  The interrupt event that triggers
      # this method also kills the sleep command in `process_jobs`,
      # so it takes effect immediately.
      @should_stop = true
    end #def
    
  end #class


  #
  # Class: I3AutomatedJobs::Job
  # 
  # Represents a scheduled job.
  # 
  class Job
    include I3::LoggingSupport
    
    # Property: defined_in
    # The full path to the file in which the job was defined.  Read-only.
    attr_reader :defined_in

    # Property: frequency
    # A `Symbol` that tells how often to run the job.  Read-only.
    attr_reader :frequency

    # Property: block
    # The block of code to execute when the job is processed.  Read-only.
    attr_reader :block
    
    # Property: next_run
    # The `Time` at which the job will be run.  Read-only.
    attr_reader :next_run
    
    #
    # Constructor: new
    # 
    # Initializes a new <Job> instance.
    # 
    # Parameters:
    #   defined_in - the full path to the file in which the job was defined
    #   block - the block of code to execute
    #   frequency - a `Symbol` that tells how often to run the job;
    #     must be one of the items in <I3AutomatedJobs::SUPPORTED_FREQUENCIES>
    #   time - optional; a four-digit string telling the specific time
    #     at which to run the job
    # 
    def initialize(defined_in, block, frequency, time=nil)
      @defined_in = defined_in
      @tool_name = self.defined_in.match(%r'/([^/]+)/meta/jobs.rb$')[1]
      @block = block
      @frequency = frequency
      self.time = time
      self.calculate_next_run
    end #def
    
    #
    # Property: time
    # 
    # A four-digit string telling the specific time at which to run
    # the job (in military time).  Read/write.
    # 
    def time
      "%02d%02d" % [ @offset / 1.hour, @offset % 1.hour / 1.minute ]
    end #def
    
    def time=(value)
      if value =~ /(\d\d)(\d\d)/
        @offset = $1.to_i.hours + $2.to_i.minutes
      else
        @offset = 0
      end #if
    end #def
    
    #
    # Method: process!
    # 
    # Executes the <block> and updates the <next_run> time.
    # 
    def process!
      I3.config.tools.current = I3.config.tools[@tool_name]
      begin
        self.block.call
      rescue
        log.error(
            "Received error '#{$!}' while processing jobs " +
            "from file '#{self.defined_in}'.\n  Backtrace:\n  " +
            $!.backtrace.join("\n  ") )
      end
      I3.config.tools.current = nil
      self.calculate_next_run
    end #def

    #
    # Method: calculate_next_run
    # 
    # Updates the <next_run> time from the <frequency> and <time> properties.
    # This is called by <process!> to schedule the job for its next run.
    # 
    def calculate_next_run
      case self.frequency
        when :hour
          @next_run = Time.now + 1.hour - Time.now.min.minutes - Time.now.sec
        when :day
          @next_run = Time.now.beginning_of_day + @offset
          @next_run += 1.day if @next_run < Time.now
        when :weekday
          case Time.now.wday
            when 0 # Sunday
              @next_run = Time.now.beginning_of_day + 1.day + @offset
            when 6 #Saturday
              @next_run = Time.now.beginning_of_day + 2.days + @offset
            else
              @next_run = Time.now.beginning_of_day + @offset
              if @next_run < Time.now
                if Time.now.wday == 5 # Friday
                  @next_run += 3.days
                else
                  @next_run += 1.day
                end
              end
          end
        when :week
          @next_run = Time.now.beginning_of_week + @offset
          @next_run += 1.week if @next_run < Time.now
        when :month
          @next_run = Time.now.beginning_of_month + @offset
          @next_run += 1.month if @next_run < Time.now
        when :monday
          @next_run = Time.now.beginning_of_week + @offset
          @next_run += 1.week if @next_run < Time.now
        when :tuesday
          @next_run = Time.now.beginning_of_week + 1.day + @offset
          @next_run += 1.week if @next_run < Time.now
        when :wednesday
          @next_run = Time.now.beginning_of_week + 2.days + @offset
          @next_run += 1.week if @next_run < Time.now
        when :thursday
          @next_run = Time.now.beginning_of_week + 3.days + @offset
          @next_run += 1.week if @next_run < Time.now
        when :friday
          @next_run = Time.now.beginning_of_week + 4.days + @offset
          @next_run += 1.week if @next_run < Time.now
        when :saturday
          @next_run = Time.now.beginning_of_week + 5.days + @offset
          @next_run += 1.week if @next_run < Time.now
        when :sunday
          @next_run = Time.now.beginning_of_week + 6.days + @offset
          @next_run += 1.week if @next_run < Time.now
      end #case
    end #def
    
  end #class

  #
  # Class Method: calendar
  # 
  # Returns the shared instance of the <JobCalendar>.
  # 
  def self.calendar
    @_calendar = JobCalendar.new if @_calendar.nil?
    return @_calendar
  end #def

  #
  # Class Method: main
  # 
  # Parses command-line arguments, reads in the job files,
  # and starts processing jobs.
  # 
  # Parameters:
  #   args - the array of command-line arguments; ignored
  # 
  def self.main(args)
    job_files = Dir["#{I3::ROOT_PATH}/tools/*/meta/jobs.rb"]
    job_files += Dir["#{I3::SITE_PATH}/tools/*/meta/jobs.rb"]
    job_files.each do |job_file|
      self.calendar.current_source = job_file
      begin
        require job_file
      rescue
        I3.log.error(self.name) do
          "Received error '%s' while loading jobs from file '%s'.\n" +
          "  Backtrace:\n  %s" %
          [ $!.to_s, job_file, $!.backtrace.join("\n  ") ]
        end #log.error
      end
    end #each
    self.calendar.current_source = nil
    trap("INT") { self.calendar.stop_processing }
    trap("TERM") { self.calendar.stop_processing }
    I3.log.info(self.name) { "Job processor started" }
    exited_normally = self.calendar.process_jobs
    if exited_normally
      I3.log.info(self.name) { "Job processor stopped" }
    else
      I3.log.info(self.name) { "There are no jobs to run" }
    end #if
  end #def

end #def

# ----------------------------------------------------------------------------

module Kernel

  # This creates a backup of Ruby's default `method_missing` implementation
  # so that we can call it from our new version.
  alias_method :__orig_method_missing, :method_missing

  # This overrides the default `method_missing` implementation to check for
  # the scheduling syntax.  The original implementation is called if the
  # syntax doesn't match.
  def method_missing(method_name, *args, &block)
    # See if the method matches the `every_xxx` pattern.
    if method_name.to_s.downcase =~ /^every_([a-z]+)(?:_at_([0-9]{4}))?$/
      frequency = $1.to_sym
      if I3AutomatedJobs::SUPPORTED_FREQUENCIES.include? frequency
        # The block that was provided will be included in `args`.
        I3AutomatedJobs.calendar.schedule_job(block, frequency, $2)
      else
        # Method frequency is not supported.
        __orig_method_missing(method_name, *args, &block)
      end #if
    else
      # Method doesn't follow the pattern.
      __orig_method_missing(method_name, *args, &block)
    end #if
  end #def

end #module


# ----------------------------------------------------------------------------

I3AutomatedJobs.main(ARGV)
