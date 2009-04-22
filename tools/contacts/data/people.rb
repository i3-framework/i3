#
# Web Service: contacts/data/people
#
# Sends a person object to the client.  The person ID is expected to be
# specified in the path.  If no specific path is provided to the web service,
# the client will be referred to the <contacts/data/summary> web service for
# a list of people.
#
# Credits:
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
#   $Id: people.rb 43 2008-01-07 17:58:02Z nmellis $
#

#
# Module: Contacts
# 
# The module containing all Contacts classes and data.
# 
module Contacts

  #
  # Class: Contacts::PeopleServlet
  # 
  # The main servlet for the People service.
  #
  class PeopleServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Processes the `path` and sends the requested person object.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_get(path)

      # Check to see if a path was given.
      if path.size > 1
        # Retrieve a single contact, whose ID is given as the path.
        person_uuid = CGI.unescape(path[1..-1])
        if person_uuid.size > 0
          log.debug person_uuid
          send_person(person_uuid)
        else
          I3.server.send_error(
            :status  => "404 Not Found",
            :title   => "Contact Not Found",
            :message => "The contact path #{path} is invalid.")
        end #if
      else
        # Path is empty or only a slash.  Send the client to the summary.
        I3.server.send_header("Status" => "301 Moved Permanently",
                              "Location" => "/contacts/data/summary")
        I3.server.send_object({ :status => "Moved Permanently" })
      end #if

    end #def

    #
    # Method: send_person
    # 
    # Sends the contact with the given `person_uuid`.
    # 
    # Parameters:
    #   person_uuid - the unique ID of the directory service person to send
    #
    def send_person(person_uuid)
      begin
        person = I3.directory.read_person(person_uuid)
      rescue
      end
      if person.nil?
        I3.server.send_error(
          :status  => "404 Not Found",
          :title   => "Contact Not Found",
          :message => "The requested contact could not be found.")
      else
      
        obj                = I3::SharedObject.new
        obj.url            = "/contacts/data/people/" + CGI.escape(person_uuid)
        obj.last_name      = person.last_name
        obj.first_name     = person.first_name
      
        obj.job_title      = person.job_title
        obj.department     = person.department
        obj.company        = person.company
      
        obj.email          = person.email.find { |key, value| value[:is_primary] == true }.to_a[0]
        obj.intranet_login = person.account_name
      
        obj.street_address = person.street_address
        obj.city           = person.city
        obj.state          = person.state
        obj.zip_code       = person.zip_code
        obj.country        = person.country
        
        obj.work_phone     = person.phone
        obj.home_phone     = person.home_phone
        obj.mobile         = person.mobile
        obj.pager          = person.pager
        obj.fax            = person.fax
        obj.extension      = person.extension
        
        I3.server.send_object(obj)
      end #if
    end #def

  end #class

end #module
