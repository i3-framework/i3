#
# File: contacts/data/model/summary
#
# Defines the <Contacts::Summary> shared object that is returned by the
# <contacts/data/summary> web service.
# 
# The summary object contains the folowing
# attributes:
# 
#   contacts - the list of people working for the organization, with
#     an abbreviated set of contact information for each
# 
# Credits:
#   Written by Marshall Elfstrand (marshall@vengefulcow.com) and
#              Nathan Mellis (nathan@mellis.us).
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
#   $Id: summary.rb 43 2008-01-07 17:58:02Z nmellis $
#

#
# Module: Contacts
# 
# The module containing all Contacts classes and data.
# 
module Contacts

  class Summary < I3::SharedObject
    include I3::LoggingSupport
    
    #
    # Constructor: new
    # 
    # Initializes a `Summary` instance.
    # 
    def initialize
      super()
      self.people = self.build_person_list
    end #def
    
    #
    # Method: build_person_list
    # 
    # Constructs a list of all people with an abbreviated set of details.
    # 
    # Returns:
    #   An `Array` of `Hash` objects, each of which contains a subset of
    #   the fields of a <Contacts::Person> record.
    # 
    def build_person_list
      person_list = []       # Result array
      uuid_list = {}         # Hash to ensure no duplicate UUIDs are retrieved
      benchmark_result = Benchmark.measure do
        people_groups = I3.config.tools["contacts"].settings.limit_to
        if people_groups.nil?
          I3.directory.find_all_people.each do |uuid|
            uuid_list[uuid] = true
          end #each
        else
          people_groups.each do |field, list|
            list.each do |group_dn|
              I3.directory.find_people(field.to_sym, group_dn).each do |uuid|
                uuid_list[uuid] = true
              end #each
            end #each
          end #each
        end #if
        uuid_list.keys.each do |uuid|
          person = I3.directory.read_person(uuid)
          obj = {
            :url => "/contacts/data/people/" + CGI.escape(uuid), 
            :last_name => person.last_name, 
            :first_name => person.first_name, 
            :display_name => person.display_name, 
            :department => person.department, 
            :job_title => person.job_title, 
            :company => person.company,
            :email => person.email.find { |key, value| value[:is_primary] == true }.to_a[0], 
            :extension => person.extension
          }
          person_list << obj
        end #each
      end #Benchmark.measure
      log.debug "Total contact list creation time: #{benchmark_result.total}s"
      return person_list
    end #def

  end #class

end #module
