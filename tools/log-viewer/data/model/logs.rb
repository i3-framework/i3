#
# File: log-viewer/data/model/logs
#
# Describe the data models that are defined in this file.
#
# Credits:
# 
#   Written by Nathan Mellis.
# 
# Copyright / License:
# 
#   Copyright 2008 Mission Aviation Fellowship
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
#   $Id: logs.rb 1646 2008-08-25 15:17:24Z nmellis $
#

#
# Module: LogViewer
#
# The module containing all Log Viewer classes and data.
#
module LogViewer

  LOGS_BASE_PATH = "#{I3::LOCAL_PATH}/files/log-viewer"

  #
  # Data Model: LogViewer::Service
  #
  # Defines the data model for the Service class.
  #
  class Service
    include I3::LoggingSupport
    
    attr_reader :service_name, :path, :hosts
    
    #
    # Class Method: find_by_account
    #
    # Description of method
    #
    # Parameters:
    #   account - description
    #
    def self.find_by_account(account)
      all_services = Dir.entries(LOGS_BASE_PATH).reject { |path| path.starts_with?(".") }
      services = all_services.select { |path| account.has_permission?(path) }
      return services.inject(Hash.new) { |hash, service| hash[service] = self.new(service); hash }
    end #self.find_by_account
    
    #
    # Method: initialize
    #
    # Description of method
    #
    # Parameters:
    #   service_name - description
    #
    def initialize(service_name)
      @service_name = service_name
      @path = File.join(LOGS_BASE_PATH, service_name)
      raise I3::NotFoundException.new unless File.exists? @path
      paths = Dir.entries(@path).reject { |path| path.starts_with?(".") }
      @hosts = paths.collect { |host| Host.new(host, self) }
    end #initialize
    
    #
    # Method: name
    #
    # Description of method
    #
    def name
      @service_name.capitalize
    end #name
    
    #
    # Method: to_shared
    #
    # Description of method
    #
    # Parameters:
    #   options=nil - description
    #
    def to_shared(options=nil)
      service = I3::SharedObject.new
      service.name = self.name
      service.service = @service_name
      service.hosts = @hosts.collect(&:name)
      service.earliest_log_date = self.earliest_log.created_at.utc
      return service
    end #to_shared
    
    #
    # Method: earliest_log
    #
    # Description of method
    #
    def earliest_log
      @hosts.collect { |host| host.logs.first }.min
    end #earliest_log
    
    #
    # Method: is_accessible_by_account?
    #
    # Description of method
    #
    # Parameters:
    #   account - description
    #
    def is_accessible_by_account?(account)
      account.has_permission?(@service_name)
    end #is_accessible_by_account?
    
    #
    # Method: search
    #
    # Description of method
    # 
    # Options hash can include the following keys:
    # 
    #   limit
    #   from
    #   history
    #   hosts
    #
    # Parameters:
    #   terms - description
    #   options - description
    #
    def search(terms, options={})
      results = {}
      hosts_to_search = options.delete(:hosts) || @hosts
      
      benchmark = Benchmark.measure do
        @hosts.select { |host| hosts_to_search.include?(host.name) }.each do |host|
          results[host.name] = host.search(terms, options)
        end #each
      end #Benchmark.measure
      
      log.info("Log Query for service '#{@service_name}': #{benchmark.total}s")
      
      return results
    end #search
    
  end #class Service
  
  # ================================================================================================
  
  #
  # Class: LogViewer::Host
  #
  # Description of class
  #
  class Host
    include I3::LoggingSupport
    
    attr_reader :name, :service, :logs
    
    #
    # Method: initialize
    #
    # Description of method
    #
    # Parameters:
    #   host_name - description
    #
    def initialize(host_name, service)
      @name = host_name
      @service = service
      @base_path = File.join(@service.path, @name)
      @logs = LogsCollection.new(@base_path, self)
    end #initialize
    
    #
    # Method: search
    # 
    # Desc
    # 
    #   limit
    #   from
    #   history
    # 
    # Parameters:
    #   terms - d
    #   options - d
    # 
    def search(terms, options={})
      # This array should be reverse ordered so that we always have the `n`-most recent entries
      results = []
      options[:limit] ||= 250
      
      from = (Time.parse(options[:from].to_s) rescue Time.now).getlocal
      
      end_date = Time.local(from.year, from.month, from.day, 23, 59, 59) # Set to midnight - 1
      days_back = (options[:history] || 1).to_i
      start_date = end_date - days_back.days
      
      log.debug "Start Date: #{start_date}"
      log.debug "End Date: #{end_date}"
      
      benchmark = Benchmark.measure do
        @logs.entries.reverse.sort.each do |log|
          break if results.size > options[:limit]
          next unless log.created_at.between?(start_date, end_date)
          results.concat(log.search(terms, options).reverse)
        end #each
      end #Benchmark.measure
      
      log.info("Log Query for service '#{@service.service_name}' on host '#{@name}': #{benchmark.total}s")
      
      return results[0..(options[:limit] - 1)].reverse
    end #search
    
  end #class Host
  
  # ================================================================================================
  
  #
  # Class: LogViewer::LogsCollection
  #
  # Description of class
  #
  class LogsCollection
    include Enumerable
    include I3::LoggingSupport
    
    #
    # Method: initialize
    #
    # Description of method
    #
    # Parameters:
    #   path - description
    #
    def initialize(path, host)
      @path = path
      @host = host
      @file_paths = Dir.entries(@path).reject { |path| path.starts_with?(".") }
      @files = @file_paths.inject(Hash.new) do |hash, file_name| 
        hash[File.basename(file_name)] = LogFile.new(File.join(@path, file_name), @host)
        hash
      end #inject
    end #initialize
    
    #
    # Method: []
    #
    # Description of method
    #
    # Parameters:
    #   file_name - description
    #
    def [](file_name)
      @files[file_name]
    end #[]
    
    #
    # Method: each
    #
    # Description of method
    #
    def each
      @files.collect { |file_name, file| file }.sort.each { |file| yield file }
    end #each
    
    #
    # Method: first
    #
    # Description of method
    #
    def first
      @files.collect { |file_name, file| file }.sort.first
    end #first
    
    #
    # Method: last
    #
    # Description of method
    #
    def last
      @files.collect { |file_name, file| file }.sort.last
    end #last
    
    #
    # Method: find_by_date
    #
    # Returns the log file that was created on `date`
    #
    # Parameters:
    #   date - description
    #
    def find_by_date(date)
      date_string = date.utc.strftime("%x")
      self.each do |log|
        if log.created_at.utc.strftime("%x") == date_string
          return log
        end #if
      end #each
    end #find_by_date
    
  end #class LogsCollection
  
  # ================================================================================================
  
  #
  # Class: LogViewer::LogFile
  #
  # Description of class
  #
  class LogFile
    include I3::LoggingSupport
    include Comparable
    
    #
    # Method: initialize
    #
    # Description of method
    #
    # Parameters:
    #   file_name - description
    #
    def initialize(path, host)
      @path = path
      @host = host
    end #initialize
    
    #
    # Method: to_shared
    #
    # Description of method
    #
    # Parameters:
    #   options=nil - description
    #
    def to_shared(options=nil)
      File.basename(@path)
    end #to_shared
    
    #
    # Method: created_at
    #
    # Description of method
    #
    def created_at
      File.mtime(@path)
    end #created_at
    
    #
    # Method: <=>
    #
    # Description of method
    #
    # Parameters:
    #   other - description
    #
    def <=>(other)
      self.created_at.utc <=> other.created_at.utc
    end #<=>
    
    #
    # Method: search
    #
    # Description of method
    #
    #   limit
    # 
    # Parameters:
    #   terms - description
    #   options - description
    #
    def search(terms, options={})
      begin
        # Run the file through 'lessopen.sh' to unzip if necessary
        # file_name = `#{I3::SITE_PATH}/bin/lessopen.sh #{@path}`.chomp
        file_name = @path # if file_name.empty?
        log.debug file_name
        
        cmd = if terms.to_s.empty?
          case File.extname(file_name)
          when ".gz"
            "gzcat #{file_name} | tail -#{options[:limit]}"
          when ".bz2"
            "bzcat #{file_name} | tail -#{options[:limit]}"
          else
            "tail -#{options[:limit]} #{file_name}"
          end #case
        else
          terms_array = terms.to_s.split("|")
          case File.extname(file_name)
          when ".gz"
            "gzcat #{file_name}" + terms_array.inject("") do |str, term|
              str += " | grep -i -e '#{term.gsub(/'/, "").strip}'"
              str
            end #inject
          when ".bz2"
            "bzgrep -i -e '#{terms_array[0].strip}' #{file_name}" + 
              terms_array[1..-1].inject("") do |str, term|
                str += " | grep -i -e '#{term.gsub(/'/, "").strip}'"
                str
              end #inject
          else
            "grep -i -e '#{terms_array[0].strip}' #{file_name}" + 
              terms_array[1..-1].inject("") do |str, term|
                str += " | grep -i -e '#{term.gsub(/'/, "").strip}'"
                str
              end #inject
          end #case
        end
        log.debug cmd
        results = `#{cmd}`
      
        # Return an array of lines that match the criteria
        results.split("\n")
      rescue
        log.error $!
        log.error $!.backtrace.join("\n")
        raise I3::ServerException.new
      ensure
        # Remove the temp file created by 'lessopen.sh' if necessary
        # `#{I3::SITE_PATH}/bin/lessclose.sh #{@path} #{file_name}`        
      end #begin
    end #search
    
  end #class LogFile

end #module LogViewer
