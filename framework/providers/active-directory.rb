#
# File: framework/providers/active-directory
#
# Provides access to an Active Directory data store for retrieving data
# about people and accounts.
#
# Credits:
# 
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
#   $Id: active-directory.rb 153 2009-03-23 19:42:43Z nmellis $
#

require "ldap"                       # Ruby/LDAP extension

#
# Module: I3Providers
#
# Module containing directory service providers.
#
module I3Providers
  
  #
  # Class: I3Providers::ActiveDirectoryProvider
  #
  # Provides person and account data from an Active Directory data store.
  #
  class ActiveDirectoryProvider < I3::ProviderBase
    include I3::LoggingSupport

    #
    # Constant: DEFAULT_PORT
    # The default port to use for Active Directory LDAP connections.
    # This value will be used if none has been specified in the configuration.
    #
    DEFAULT_PORT = 389
        
    #
    # Constant: PERSON_FIELD_MAP
    # Hash mapping AD field names to equivalent intranet fields.
    # 
    PERSON_FIELD_MAP = {
      :dn                             => :dn,
      :objectGUID                     => :uuid,
      :givenName                      => :first_name,
      :sn                             => :last_name,
      :displayName                    => :display_name, 
      :description                    => :description,
      :mail                           => :email,
      :otherMailbox                   => :email,
      :proxyAddresses                 => :email,
      :telephoneNumber                => :phone,
      :otherTelephone                 => :other_phone, 
      :homePhone                      => :home_phone,
      :otherHomePhone                 => :other_home_phone, 
      :pager                          => :pager,
      :otherPager                     => :other_pager, 
      :mobile                         => :mobile,
      :otherMobile                    => :other_mobile, 
      :facsimileTelephoneNumber       => :fax,
      :otherFacsimileTelephoneNumber  => :other_fax, 
      :ipPhone                        => :extension,
      :otherIpPhone                   => :other_extension, 
      :streetAddress                  => :street_address,
      :postOfficeBox                  => :po_box, 
      :l                              => :city,
      :st                             => :state,
      :postalCode                     => :zip_code,
      :co                             => :country,
      :sAMAccountName                 => :account_name,
      :memberOf                       => :groups,
      :showInAddressBook              => :address_lists,
      :userAccountControl             => :is_enabled,
      :title                          => :job_title,
      :department                     => :department,
      :company                        => :company,
      :manager                        => :manager_dn, 
      :wWWHomePage                    => :website
    }
    

    #
    # Constant: FIELD_LIST
    # List of AD fields to retrieve from the server for person objects.
    # 
    PERSON_FIELD_LIST = PERSON_FIELD_MAP.stringify_keys.keys

    #
    # Method: connect
    #
    # Establishes a connection (binds) to Active Directory.
    # This is called automatically when `I3.directory` is used; you will
    # normally not need to call it yourself.
    #
    def connect
      self.settings.symbolize_keys!
      if @conn.nil?
        self.port = DEFAULT_PORT if self.port.nil?
        @conn = LDAP::Conn.new(self.host, self.port)
        @conn.set_option(LDAP::LDAP_OPT_PROTOCOL_VERSION, 3)
      end #if
      @conn.bind(self.username, self.password) unless @conn.bound?
      return @conn.bound?
    end #def

    #
    # Method: find_all_groups
    #
    # Returns the list of group distinguished names (DNs) in the directory
    # service.
    # 
    # Returns:
    #   An `Array` of DN strings, each of which can be used to set group
    #   permissions.
    #
    def find_all_groups
      return collect_from_search_paths do |search_path|
        perform_query(search_path,
            "(|(objectClass=organizationalUnit)(objectClass=group))", ["dn"]
            ).collect { |entry| entry["dn"][0] }
      end #collect_from_search_paths
    end
    
    #
    # Method: find_all_people
    #
    # Returns a list of all the people in the directory service that are in the search paths.
    # 
    # Returns:
    #   An `Array` of UUID strings, each of which can be passed to <read_person> to obtain data 
    #   about a person in the directory.
    #
    def find_all_people
      return collect_from_search_paths do |search_path|
        perform_query(search_path, 
          "(objectClass=person)", ["objectGUID"]
          ).collect { |item| format_uuid(item["objectGUID"][0]) }
      end #collect_from_search_paths
    end #find_all_people

    #
    # Method: find_people
    # 
    # Returns the list of person UUIDs in the directory service that match
    # a particular search value.
    # 
    # Parameters:
    #   search_field - the field symbol to search on (e.g. `:email`)
    #   value - the value to search for (e.g. "user@host.com")
    #   limit - optional; maximum number of entries to return
    # 
    # Returns:
    #   An `Array` of UUID strings, each of which can be passed to
    #   <read_person> to obtain data about a person in the directory.
    # 
    def find_people(search_field, value, limit=nil)
      return collect_from_search_paths(limit) do |search_path|
        search_ldap(search_field, value, search_path)
      end #collect_from_search_paths
    end #def

    #
    # Method: read_person
    #
    # Reads the data for a person from the directory.
    # Providers must override this method.
    #
    # Parameters:
    #   uuid - description
    #
    # Returns:
    #   An <I3::SharedObject> containing the data fields for the person
    #   obtained from the directory service.
    # 
    def read_person(uuid)

      # Convert UUID back into binary format and escape as
      # hexadecimal characters for searching.
      binary_uuid = parse_uuid(uuid)
      if binary_uuid.nil?
        raise ArgumentError,
              'Cannot search directory: "%s" is not a valid UUID.' % value
      end #if
      ldap_query = "objectGUID=" + escape_for_query(binary_uuid)
      
      # Go through the search paths until we find a result.
      collect_from_search_paths do |search_path|
        entries = perform_query(search_path, ldap_query, PERSON_FIELD_LIST)
        return translate_person_object(entries[0]) if entries.size > 0
      end #collect_from_search_paths

      # If we've gotten here, we have no matches.
      return nil
    end

    #
    # Method: write_person
    #
    # Writes the data for a person to the directory.
    # Providers must override this method.
    #
    # Parameters:
    #   data - An <I3::SharedObject> containing the data fields to be
    #     written to the directory.  The data must include a `uuid`
    #     for lookup.  Any fields not included in the shared object
    #     will not be modified in the directory.
    #
    def write_person(data)
      raise "Required method not implemented in #{self.class.name}: " +
            "write_person"
    end

    private
    
    #
    # Method: collect_from_search_paths
    #
    # Executes a block for each search path and combines the results.
    # The block is expected to return an array.
    #
    # Parameters:
    #   limit - optional; maximum number of results to return
    #
    def collect_from_search_paths(limit=nil)
      if self.settings[:search_paths].nil?
        raise "Missing search_paths in directory configuration."
      end #if
      results = []
      self.settings[:search_paths].each do |search_path|
        result = yield search_path
        if result.is_a? Array then results += result
        else results << result
        end #if
        return results[0...limit] if limit and results.size >= limit
      end #each
      return results
    end
    
    #
    # Private Method: search_ldap
    #
    # Performs a search for person data in the Active Directory data store.
    #
    # Parameters:
    #   search_field - the contact/user field to search on.  This will
    #     be mapped to the LDAP field using the `PERSON_FIELD_MAP` hash.
    #   value - the value to search for
    #   search_base - path in the LDAP store where the search should begin
    #
    # Returns:
    #   A `Hash` of directory fields from the first matching entry.  Each
    #   directory field is expected to be an array of values (even if just
    #   one value is present).  Any changes made to the returned objects
    #   will not affect the data stored on the LDAP server.
    #
    def search_ldap(search_field, value, search_base)

      # Handle groups, e-mail, and UUID queries specially.
      case search_field
        when :groups
          # Determine if we need to search for users in an OU or
          # members of a group.
          if value.downcase.starts_with? "ou=" and
             value.downcase.ends_with? search_base.downcase
            queries = [ "objectClass=person" ]
            search_base = value
          else
            queries = [ "&(objectClass=person)(memberOf=#{value})" ]
          end #if
        when :email
          # Search mail, otherMailbox, and proxyAddresses fields
          queries = [ "mail~=#{value}",
                      "otherMailbox~=#{value}",
                      "proxyAddresses~=smtp:#{value}" ]
        when :address_lists
          queries = [ "&(objectClass=person)(showInAddressBook=#{value})" ]
        when :uuid
          # Convert UUID back into binary format and escape as
          # hexadecimal characters for searching.
          uuid_value = parse_uuid(value)
          if uuid_value.nil?
            raise ArgumentError,
                  'Cannot search directory: "%s" is not a valid UUID.' % value
          end #if
          queries = [ "objectGUID=" + escape_for_query(uuid_value) ]
        when :dn
          # Active Directory uses the `distinguishedName` field for this.  `dn` doesn't actually 
          # exist as a field in the directory
          queries = [ "distinguishedName=#{value}" ]
        else
          # Use field list to determine AD field name.
          search_field = PERSON_FIELD_MAP.invert[search_field].to_s
          queries = [ "#{search_field}~=#{value}" ]
      end #case

      # Build an LDAP binary "or" query out of the query elements
      # and perform the query operation.
      query = "(%s)" % queries[0]
      if queries.size > 1
        queries[1..-1].each { |subq| query = "(|%s(%s))" % [query, subq] }
      end #if
      arr = perform_query(search_base, query, ["objectGUID"])
      
      # Return the array of formatted GUIDs.
      return [] if arr.to_a.size < 1
      return arr.collect { |item| format_uuid(item["objectGUID"][0]) }

    end #def
    
    #
    # Method: perform_query
    #
    # Executes an LDAP query against the Active Directory store.
    #
    # Parameters:
    #   search_base - description
    #   query - description
    #   field_list - description
    # 
    # Returns:
    #   An `Array` of `Hash` objects, each of which contains the fields
    #   specified in the `field_list`.
    #
    def perform_query(search_base, query, field_list)
      begin
        arr = @conn.search2(search_base, LDAP::LDAP_SCOPE_SUBTREE,
          query, field_list)
      rescue RuntimeError
        # LDAP server timed out.  Re-connect and try the search again.
        @conn.unbind
        @conn.bind(self.username, self.password)
        arr = @conn.search2(search_base, LDAP::LDAP_SCOPE_SUBTREE,
          query, field_list)
      end
      return arr
    end
    
    #
    # Method: translate_person_object
    #
    # Translates the fields from an LDAP hash to an <I3::SharedObject>
    # in the format that the intranet expects.
    #
    # Parameters:
    #   obj - the person object retrieved from the Active Directory store
    # 
    # Returns:
    #   An <I3::SharedObject> containing the fields for the person.
    #
    def translate_person_object(obj)
      
      translated_obj = I3::SharedObject.new
      obj.symbolize_keys!

      # Handle UUID field.
      translated_obj[:uuid] = format_uuid(obj[:objectGUID][0])
      obj.delete(:objectGUID)
      
      # Handle e-mail address fields.
      translated_obj[:email] = Hash.new
      if obj[:mail].to_a.size > 0
        translated_obj[:email][obj[:mail].to_a[0].downcase] =
          { :is_primary => true, :tag => "mail" }
      end #if
      obj.delete(:mail)
      if obj[:otherMailbox].to_a.size > 0
        obj[:otherMailbox].each do |addr|
          addr.downcase!
          unless translated_obj[:email].include? addr
            translated_obj[:email][addr] =
              { :is_primary => false, :tag => "other" }
          end #unless
        end #each
      end #if
      obj.delete(:otherMailbox)
      if obj[:proxyAddresses].to_a.size > 0
        obj[:proxyAddresses].each do |addr|
          if (addr.downcase.starts_with? "smtp:")
            addr = addr[5..-1].downcase
            unless translated_obj[:email].include? addr
              translated_obj[:email][addr] =
                { :is_primary => false, :tag => "proxy" }
            end #unless
          end #if
        end #each
      end #if
      obj.delete(:proxyAddresses)
      
      # Make sure we have a primary address.
      if translated_obj[:email].size > 0
        primary_addr = translated_obj[:email].find do |addr, info|
          info[:is_primary]
        end #find
        if primary_addr.nil?
          # Sort the e-mail addresses and pick the first one as primary.
          first_addr = translated_obj[:email].keys.sort[0]
          translated_obj[:email][first_addr][:is_primary] = true
        end #if
      end #if
      
      # Handle user account control field.
      if obj[:userAccountControl].to_a.size > 0
        uacData = ADUserAccountControlData.new(obj[:userAccountControl][0])
        translated_obj[:is_enabled] = (not uacData.account_disabled?)
      end #if
      obj.delete(:userAccountControl)
      
      # Handle groups.
      # The first group entry is the OU that contains this entry.
      translated_obj[:groups] = [obj[:dn][0].split(",")[1..-1].join(",")]
      if obj[:memberOf].to_a.size > 0
        translated_obj[:groups] += obj[:memberOf]
      end #if
      obj.delete(:memberOf)
      
      # Handle extra phone numbers
      other_phone = {}
      other_phone_fields = [:otherTelephone, :otherHomePhone, :otherPager, :otherMobile, 
                            :otherFacsimileTelephoneNumber, :otherIpPhone]
      other_phone_fields.each do |field|
        if obj[field].to_a.size > 0
          other_phone[PERSON_FIELD_MAP[field].to_s[6..-1].to_sym] = obj[field].to_a
        end #if
        obj.delete(field)
      end #each
      translated_obj[:other_phone] = other_phone if other_phone.size > 0
      
      
      # Copy remaining fields using the field list to translate names.
      obj.each { |k, v| translated_obj[PERSON_FIELD_MAP[k]] = v.to_a[0] }

      return translated_obj
    end
    
    #
    # Private Method: format_uuid
    # 
    # Formats a 16-byte UUID in the usual display format of groups of
    # hexadecimal characters separated by hyphens and surrounded by
    # curly braces.
    # 
    # Parameters:
    #   binary_string - the UUID data as a string of 16 bytes
    # 
    # Returns:
    #   A string representing the UUID in the standard display format.
    # 
    def format_uuid(binary_string)
      return "{" +
        binary_string[0..3].reverse.unpack("H*")[0] + "-" +
        binary_string[4..5].reverse.unpack("H*")[0] + "-" +
        binary_string[6..7].reverse.unpack("H*")[0] + "-" +
        binary_string[8..9].unpack("H*")[0] + "-" +
        binary_string[10..15].unpack("H*")[0] + "}"
    end #def
    
    #
    # Private Method: parse_uuid
    # 
    # Converts a display-formatted UUID back into a series of 16 bytes.
    # 
    # Parameters:
    #   formatted_uuid - the UUID string in the standard display format
    # 
    # Returns:
    #   The UUID data as a string of 16 bytes.
    # 
    def parse_uuid(formatted_uuid)
      if formatted_uuid =~ /^\{(\w{8})-(\w{4})-(\w{4})-(\w{4})-(\w{12})\}$/
        return [$1].pack("H*").reverse +
               [$2].pack("H*").reverse +
               [$3].pack("H*").reverse +
               [$4].pack("H*") +
               [$5].pack("H*")
      else
        return nil
      end #if
    end #def
    
    #
    # Private Method: escape_for_query
    # 
    # Formats a binary value as escaped characters so that it can be used
    # in an LDAP query string.
    # 
    # Parameters:
    #   binary_value - the string of bytes to escape
    # 
    # Returns:
    #   A string containing the escape codes for the bytes.
    # 
    def escape_for_query(binary_value)
      hex_bytes = binary_value.unpack("H2" * binary_value.size)
      return (hex_bytes.collect { |c| "\\" + c }.join)
    end #def
    
  end #class

  #
  # Class: I3Providers::ADUserAccountControlData
  #
  # Extracts values from the userAccountControl field of Active Directory
  # accounts.
  #
  class ADUserAccountControlData

    def initialize(numeric_value)
      numeric_value = numeric_value.to_i if numeric_value.class == String
      @values = []
      numeric_value.to_s(2).each_byte { |byte| @values << (byte == 49) }
    end #def

    FIELDS = {
      -1 => "script",
      -2 => "account_disabled",
      -4 => "homedir_required",
      -5 => "lockout",
      -6 => "password_not_required",
      -7 => "password_cant_change",
      -8 => "encrypted_text_pwd_allowed",
      -9 => "temp_duplicate_account",
      -10 => "normal_account",
      -12 => "workstation_trust_account",
      -13 => "interdomain_trust_account",
      -14 => "server_trust_account",
      -17 => "dont_expire_password",
      -18 => "mns_logon_account",
      -19 => "smartcard_required",
      -20 => "trusted_for_delegation",
      -21 => "not_delegated",
      -22 => "use_des_key_only",
      -23 => "dont_req_preauth",
      -24 => "password_expired",
      -25 => "trusted_to_auth_for_delegation"
    }
    
    FIELDS.each do |field_index, field_name|
      class_eval(<<-EOS, __FILE__, __LINE__)
        def #{field_name}?; @values[#{field_index}]; end
        def #{field_name}=(val); @values[#{field_index}] = val; end
      EOS
    end #each

    #
    # Method: descriptions
    # 
    # Returns an array of descriptions of each control that is enabled
    # on the account.
    # 
    def descriptions
      result = []
      result << "Login Script Enabled" if self.script?
      result << "Account Disabled" if self.account_disabled?
      result << "Home Directory Required" if self.homedir_required?
      result << "Account Locked" if self.lockout?
      result << "Password Not Required" if self.password_not_required?
      result << "User Cannot Change Password" if self.password_cant_change?
      result << "Encrypted Text Password Allowed" if self.encrypted_text_pwd_allowed?
      result << "Temporary Duplicate Account" if self.temp_duplicate_account?
      result << "Normal User Account" if self.normal_account?
      result << "Interdomain Trust Account" if self.interdomain_trust_account?
      result << "Computer Account" if self.workstation_trust_account?
      result << "Domain Controller Account" if self.server_trust_account?
      result << "Password Never Expires" if self.dont_expire_password?
      result << "MNS Logon Account" if self.mns_logon_account?
      result << "Smart Card Required" if self.smartcard_required?
      result << "Trusted For Kerberos Delegation" if self.trusted_for_delegation?
      result << "Not Delegated" if self.not_delegated?
      result << "Only Allow DES Keys" if self.use_des_key_only?
      result << "Kerberos Pre-Authentication Not Required" if self.dont_req_preauth?
      result << "Password Expired" if self.password_expired?
      result << "Trusted To Authenticate For Kerberos Delegation" if self.trusted_to_auth_for_delegation?
      result
    end #def

    #
    # Method: to_s
    # 
    # Returns the uacData numeric field in decimal notation as a string.
    # 
    def to_s
      @values.collect { |val| val ? "1" : "0" }.join.to_i(2).to_s
    end #def
  
  end #class  
end #module
