#
# File: common/data/model/person
#
# Defines the data models for person and account management, including
# <I3::Person>, <I3::Account>, <I3::EmailAddress>, and <I3::Permission>.
#
# Each person that the intranet knows about has an <I3::Person> record
# that provides a cached copy of an entry in the directory service.  This
# includes the person's name, phone number(s), address, and so forth.
# A person has one or more <I3::EmailAddress> records associated with it
# that provide the addresses that the person uses.  You can look up a person
# by e-mail address using the <I3::Person.find_or_create> class method.
# 
# People who have directory accounts will have an associated <I3::Account>
# record, which supplies the account name and group membership.  Accounts
# can be looked up by account name using <I3::Account.find_or_create>.
# 
# Person and Account data is updated automatically from the directory service
# when a `find_or_create` method is called, unless the data has already been
# updated recently.  An update from the directory server can be forced by
# calling <I3::Person::sync_with_directory>.
#
# The <I3::Account::has_permission?> method can be used to check permissions
# for an account.  This evaluates both the permissions explicitly assigned to
# the account and the account's group membership.  It is also possible to
# search for all permissions using the <I3::Permission> class.
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
#   $Id: person.rb 58 2008-02-25 23:26:33Z nmellis $
#

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Data Model: I3::Person
  # 
  # Provides a person's contact information.  The data for the person is cached
  # from the directory service (see <framework/intranet/directory>) whenever
  # possible.  Person objects have the following properties:
  # 
  #   first_name - the person's first name
  #   last_name - the person's last name
  #   account - the <I3::Account> associated with the person, or `nil` if
  #     the person does not have an intranet account
  #   description - a description of the person
  #   email_addresses - an array of <I3::EmailAddress> objects, each of which
  #     represents an e-mail address associated with the person.  The `email`
  #     property returns the string representation of the primary e-mail
  #     address.
  #   phone - the person's land-line phone number
  #   mobile - the person's mobile phone number
  #   street_address - the person's street address
  #   city - the city in which the person lives
  #   state - the state or province in which the person lives
  #   zip_code - the mailing code for the person
  #   country - the 2-character country code for the person
  #   is_in_directory? - `true` if the person is in the directory service
  #     and can be synchronized
  #   directory_uuid - the UUID used to look up the person in the directory
  #     service
  #   updated_at - the date/time at which this person was last synchronized
  #     with the directory service
  # 
  # Several other properties, such as `full_name` and `email`, are not
  # stored as part of the record, but are provided for read-only convenience.
  # 
  class Person < I3::Record
    
    #
    # Constant: COUNTRIES
    # 
    # Hash that maps 2-character country codes to full names.
    # This is used by <I3::Record::country_name> to provide the
    # human-readable string for the country.
    # 
    COUNTRIES = YAML.load(File.read("#{I3::ROOT_PATH}/framework/resources/countries.yml"))
    
    has_one  :account
    has_many :email_addresses

    #
    # Property: full_name
    #
    # The full name (first and last) of the person.
    # Read-only.
    #
    def full_name
      return (self.first_name.to_s + " " + self.last_name.to_s).strip
    end #def
    
    #
    # Property: country_name
    #
    # The full name of the country in which the person lives.
    # Read-only.
    #
    def country_name
      return nil if self.country.to_s.empty?
      return COUNTRIES[self.country]
    end
    
    #
    # Property: email
    #
    # The primary e-mail address string for the person.
    # Read-only.
    #
    def email
      return self.email_addresses.to_a.find { |addr| addr.is_primary? }.to_s
    end #def
    
    #
    # Property: needs_update?
    #
    # `true` when the person's data is out-of-date and needs to be refreshed
    # from the directory service.  Read-only.
    #
    def needs_update?
      return (self.is_in_directory? and (Time.now > self.updated_at + 1.hour))
    end #def

    #
    # Method: before_save
    #
    # Updates the modification time of the person.  Active Record calls this
    # before the record is saved.
    #
    def before_save
      self.updated_at = Time.now.utc
    end
    
    #
    # Method: to_s
    # 
    # Returns a string representation of the person.  The string is built
    # from the full name, followed by the e-mail address in angle brackets
    # if available.
    # 
    def to_s
      str = self.full_name
      str = '#' + self.id.to_s if str.size == 0  # Use ID if no name
      str += ' (' + self.email + ')' if self.email.size > 0
      return str
    end #def

    #
    # Method: sync_with_directory
    #
    # Updates the person's cached data from the directory service.
    #
    # This is called automatically by <I3::Person.find_or_create> when the
    # data hasn't been re-cached for some time, but it may be useful to call
    # it directly after changing a person's data in the directory service so
    # that the intranet's cache is sure to have the latest data.
    #
    def sync_with_directory
      return self if self.directory_uuid.to_s.size == 0
      
      # Look up the person's directory entry.
      begin
        data = I3.directory.read_person(self.directory_uuid)
      rescue
        log.error "Directory service provider failed on person %s: %s" %
                  [self.to_s, $!.to_s]
        return self
      end
      
      # Disable the account if there is no data.
      if data.nil?
        log.info "#{self} was not found in the directory."
        self.directory_uuid = nil
        self.is_in_directory = false
        if self.account
          self.account.is_enabled = false
          self.account.save
          log.info "Account disabled for #{self.account}: " +
                   "Not found in directory."
        end #if
        self.save
        return self
      end #if
      
      # Person was found in the directory.
      self.is_in_directory = true
      
      # Update name.
      self.first_name = data.first_name
      self.last_name = data.last_name

      # Update description (department, location, etc.)
      self.description = data.description

      # Update phone numbers.
      self.phone = data.phone
      self.mobile = data.mobile

      # Update address.
      self.street_address = data.street_address
      self.city = data.city
      self.state = data.state
      self.zip_code = data.zip_code
      self.country = data.country
      
      # Update the account information.
      if data.account_name
        if self.account
          acct = self.account
        else
          acct = Account.new
          acct.person = self
        end #if
        acct.account_name = data.account_name
        acct.groups = data.groups
        acct.is_enabled = data.is_enabled
        acct.save
      else
        # No account in directory.  Disable any existing account.
        if self.account
          self.account.is_enabled = false
          self.account.save
          log.info "Account disabled for #{self.account}: " +
                   "Directory entry does not include an account name."
        end #if
      end #if

      # Find e-mail address anomalies.
      affected_people = {}
      if data.email.is_a? Hash
        data_emails = data.email.keys.collect { |addr| addr.downcase }
      else
        data_emails = data.email.collect { |addr| addr.downcase }
      end #if
      self_emails = self.email_addresses.collect { |addr| addr.to_s.downcase }
      (data_emails - self_emails).each do |addr|
        # E-mail address exists in the directory but does not exist in this
        # person's list of addresses.  See if it exists elsewhere in the
        # e-mail address database.
        user, host = addr.split("@")
        addr_record = EmailAddress.find_by_user_and_host(user, host)
        if addr_record
          # Address is attached to another person.  Move to this person and
          # mark the other person as needing synchronization, if applicable.
          old_person = addr_record.person
          addr_record.person = self
          addr_record.save
          if old_person and old_person.is_in_directory?
            # The previous holder of the address is in the directory and
            # needs to be synchronized to update its e-mail addresses.
            affected_people[old_person.directory_uuid] = true
            log.info "#{self} has claimed the e-mail address #{addr} from " +
                     "another person.  The previous owner, #{old_person}, " +
                     "has been marked for synchronization."
          else
            # The previous holder of the address is not in the directory
            # and may need to have a new primary address assigned.
            old_primary = old_person.email_addresses.select do |addr_record|
              addr_record.is_primary?
            end #select
            if old_primary.nil? and old_person.email_addresses.size > 0
              # No primary address.  Use the first one in the array.
              old_person.email_addresses[0].is_primary = true
              old_person.email_addresses[0].save
              log.info "#{self} has claimed the e-mail address #{addr} " +
                       "from another person.  The primary address of the " +
                       "previous owner, #{old_person}, has changed."
            end #if
          end #if
        else
          # Address does not already exist in the database.
          # Create a new e-mail address for this person.
          addr_record = EmailAddress.new
          addr_record.person = self
          addr_record.user = user
          addr_record.host = host
          addr_record.save
          log.info "The e-mail address #{addr} has been added to #{self}."
        end #if
      end #each
      (self_emails - data_emails).each do |addr|
        # Address is not attached to this person in the directory service.
        # See if it's attached to someone else and needs to be moved.
        email_person_uuid = I3.directory.find_person_by_email(addr)
        unless email_person_uuid.nil?
          # The other person needs to be synchronized.  Disassociate the
          # e-mail address from this record so that it doesn't cause a
          # re-sync of this record when the other person claims the address
          # during its sync operation.
          affected_people[email_person_uuid] = true
          user, host = addr.split("@")
          addr_record = EmailAddress.find_by_user_and_host(user, host)
          addr_record.person = nil
          addr_record.save
          email_person_data = I3.directory.read_person(email_person_uuid)
          log.info "%s %s has claimed the e-mail address %s from %s.  " +
                   "The new owner has been marked for synchronization." % [
                     email_person_data.first_name.to_s,
                     email_person_data.last_name.to_s,
                     addr, self.to_s]
        end #unless
      end #each

      # Assign tags and mark the primary address as applicable.
      # If the email data is a Hash, we can use it for the primary
      # and tag data.  If the email data is an Array, the first element
      # is considered to be primary, and no tags are assigned.
      if data.email.is_a? Hash
        data_emails = Hash.new
        data.email.each { |k, v| data_emails[k.downcase] =  v }
        self.email_addresses(true).each do |addr_rec|
          data_email = data_emails[addr_rec.to_s.downcase]
          unless data_email.nil?
            addr_rec.is_primary = (data_email[:is_primary] == true)
            addr_rec.tag = (data_email[:tag])
            addr_rec.save
          end #unless
        end #each
      else
        primary_email = data.email.downcase
        self.email_addresses.each do |addr_rec|
          addr_rec.is_primary = (addr_rec.to_s.downcase == primary_email)
          addr_rec.save
        end #each
      end #if

      # Save the updated record.
      self.save
      log.info "Directory service data synchronized for #{self}."

      # Update people that were affected by this sync operation.
      if affected_people.size > 0
        log.info "Synchronizing #{affected_people.size} additional records " +
                 "as a result of changes to #{self}."
        affected_people.keys.each { |uuid| Person.sync_uuid(uuid) }
      end #if

      return self
    end #def
      
    #
    # Class Method: find_or_create
    # 
    # Looks up an e-mail address and returns the first matching <I3::Person>
    # record.  A new record will be created if one does not already exist and
    # there is a matching entry in the directory service.
    # 
    # This method will return `nil` if the e-mail address does not exist in
    # either the intranet's data or the directory service.  Use the
    # <I3::Person.new_from_email> method to create an <I3::Person> record
    # that is not connected to a directory entry.
    # 
    # Parameters:
    #   email - the e-mail address of the person to locate
    # 
    # Returns:
    #   An <I3::Person> instance, or `nil` if the person could not be found.
    # 
    def self.find_or_create(email)
      email = email.downcase
      user, host = email.split("@")
      addr = EmailAddress.find_by_user_and_host(user, host)
      if addr and addr.person and not addr.person.needs_update?
        # We have a recently updated cached copy of this person.
        return self.cast_person(addr.person)
      else
        # Look up the e-mail address in the directory service.
        person_uuid = I3.directory.find_person_by_email(email)
        if person_uuid
          # Found the person in the directory service.  Use the directory's
          # UUID to find or create a Person record.
          return self.sync_uuid(person_uuid)
        else
          # E-mail address is not in the directory.  Return what
          # we have in the database, if anything.
          if addr and addr.person
            addr.person.sync_with_directory if addr.person.is_in_directory?
            return self.cast_person(addr.person)
          else
            return nil
          end #if
        end #if
      end #if
    end #def
    
    #
    # Class Method: new_from_email
    # 
    # Creates a new <I3::Person> record that is not associated with an
    # entry in the directory service.
    # 
    # An <I3::Person> instance will be created with a single e-mail address
    # associated with it.  The `first_name` and `last_name` fields of the
    # person will be derived from the `display_name` parameter.  The caller
    # of this method should replace these and any other applicable fields
    # with additional data, if possible.
    # 
    # Parameters:
    #   email - the e-mail address of the new person
    #   display_name - the name to associate with the e-mail address
    # 
    # Returns:
    #   A newly initialized <I3::Person> instance.
    # 
    # Raises:
    #   `ArgumentError` if the `email` argument does not contain
    #   the "@" character.
    # 
    def self.new_from_email(email, display_name)
      unless email.include? "@"
        raise ArgumentError, "Invalid e-mail address: #{email}"
      end #unless
      user, host = email.split("@")
      name_parts = display_name.split(" ")
      person = self.new
      person.last_name = name_parts[-1]
      person.first_name = name_parts[0..-2].join(" ")
      person.is_in_directory = false
      person.save
      addr_record = EmailAddress.new
      addr_record.person = person
      addr_record.user = user
      addr_record.host = host
      addr_record.display_name = display_name
      addr_record.is_primary = true
      addr_record.save
      return person
    end #def

    #
    # Class Method (Hidden): sync_uuid
    # 
    # Finds a Person object that matches the given directory UUID,
    # creating one if necessary, and tells it to synchronize.
    # 
    # Parameters:
    #   uuid - the unique identifier that the directory service uses
    #     to refer to this person object
    # 
    # Returns:
    #   the synchronized person object
    # 
    def self.sync_uuid(uuid)
      # See if we have a cached copy of the person.
      person = self.find_by_directory_uuid(uuid)
      if person.nil?
        # No cached copy.  Create a new record.
        person = self.new
        person.directory_uuid = uuid
        person.save
      end #if
      # Update the cached copy.
      person.sync_with_directory
      return person
    end #def

    #
    # Class Method (Hidden): cast_person
    # 
    # Ensures that the person object being returned is an instance of this
    # class.  This ensures that subclasses of `I3::Person` get instances
    # of their own class instead of the actual `I3::Person` class.
    # 
    def self.cast_person(person)
      return nil if person.nil?
      return person if self == person.class
      return self.find(person.id)
    end #def

  end #class
  
  #
  # Data Model: I3::Account
  #
  # Represents an intranet user account.  The data for the account is
  # cached from the directory service when its associated <I3::Person>
  # is synchronized.  Account objects have the following properties:
  # 
  #   account_name - the network account name
  #   person - the <I3::Person> to whom the account belongs
  #   groups - the array of groups to which the account belongs.  Each entry
  #     in the array is the distinguished name of a group (usually an LDAP DN
  #     or UNIX group name, depending on the directory provider).
  #   permissions - the array of <I3::Permission> objects that have been
  #     specifically assigned to this account.  Note that the `permissions`
  #     array does not include permissions assigned to the groups to which
  #     the account belongs.  The <I3::Account::has_permission?> method can
  #     be used to check for both group and account-specific permissions.
  #   is_enabled? - `true` if the account is allowed to access the intranet
  #   accessed_at - the date/time at which the account was last used to access
  #     the intranet
  #
  class Account < I3::Record
    
    serialize  :groups, Array
    belongs_to :person
    has_many   :permissions

    #
    # Class Method: find_or_create
    # 
    # Looks up an account name and returns the first matching <I3::Account>
    # record.  A new record will be created if one does not already exist
    # and the account is found in the directory service.
    # 
    # Note that accounts may be disabled; an account's mere existence does
    # _not_ authorize it for intranet access.  Check the `is_enabled?` and
    # `has_permission?` methods before allowing an account to do anything.
    # 
    # Parameters:
    #   account_name - the name of the account to locate
    # 
    # Returns:
    #   An <I3::Account> instance, or `nil` if the account could not be found.
    # 
    def self.find_or_create(account_name)
      account_name = account_name.downcase

      # Find an account.  Prefer enabled accounts over disabled ones
      # if multiple matching accounts are found.
      accounts = self.find_all_by_account_name(account_name)
      case accounts.size
        when 0: acct = nil
        when 1: acct = accounts[0]
        else
          enabled_accounts = accounts.select { |account| account.is_enabled? }
          if enabled_accounts.size > 0
            acct = enabled_accounts[0]
          else
            acct = accounts[0]
          end #if
      end #case

      # Check to see if the account needs to be synchronized.
      if acct and acct.person and not acct.person.needs_update?
        # We have a recently updated cached copy of this account.
        return acct
      else
        # Look up the account in the directory service.
        person_uuid = I3.directory.find_person_by_account_name(account_name)
        if person_uuid
          # Found the account in the directory service.  See if the UUID
          # matches the person this account is associated with in the
          # intranet's copy of the data.
          if acct and acct.person and (
              acct.person.directory_uuid == person_uuid)
            # Person matches.  We can sync the person.
            acct.person.sync_with_directory
            return acct
          else
            # Account is not in the intranet's copy of the data, or it is
            # now associated with a different person.  Disable any existing
            # account and return the new person.
            if acct
              acct.is_enabled = false
              acct.save
            end #if
            return Person.sync_uuid(person_uuid).account
          end #if
        else
          # Account is not in the directory.  Synchronize if possible
          # (which will disable the record if it is active) and do not
          # return anything.
          if acct and acct.person and acct.person.is_in_directory?
            acct.person.sync_with_directory
          end #if
          return acct
        end #if
      end #if

    end #def
    
    #
    # Method: has_permission?
    #
    # Checks to see if the account has a specific privilege for a tool.
    # If the `tool` is omitted, the name of the tool that the currently
    # requested servlet belongs to is used.
    #
    # Examples:
    #
    # (start example)
    #   # See if the current intranet user has the "view-all" privilege
    #   # for the tool that this servlet belongs to.
    #   if I3.server.remote_account.has_permission?("view-all")
    #     # ...
    #   end #if
    # (end example)
    #
    # (start example)
    #     # See if a specific user account has a privilege for another tool.
    #     user = I3::Account.find_or_create("bwayne")
    #     if user.has_permission?("drive", "batmobile")
    #       # ...
    #     end #if
    # (end example)
    #
    # Parameters:
    #   privilege - the privilege that the account needs to have,
    #     e.g. "access-tool", "administer"
    #   tool - optional; the short (directory) name of the tool
    #     to which the privilege belongs, e.g. "bboard", "devworld"
    #
    # Returns:
    #   `true` if the account has the privilege, `false` otherwise.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Account> class
    #   is being used in an interactive session or a non-intranet script).
    #
    def has_permission?(privilege, tool=nil)
      # Provide a default tool if none is supplied.
      if tool.nil?
        tool_object = I3.config.tools.current
        if tool_object.nil?
          raise ArgumentError, "No tool was specified and no default tool " +
                               "can be determined."
        else
          tool = tool_object.dir
        end #if
      end #if
      # First see if the user has specific permissions for this.
      conditions = ["tool = ? AND privilege = ?", tool, privilege]
      return true unless self.permissions.find(:first, :conditions => conditions).nil?
      # User check failed; see if user is in one of the groups with the
      # requested privilege.
      value = false
      conditions = ["tool = ? AND privilege = ? AND is_group = ?",
                    tool, privilege, 1]
      Permission.find(:all, :conditions => conditions).each do |perm|
        value = true if self.member_of? perm.group_dn
      end #each
      return value
    end #def

    #
    # Method: member_of?
    #
    # Checks to see if the account is a member of a group.
    #
    # Parameters:
    #   group_dn - the name or LDAP path of the group to check
    # 
    # Returns:
    #   `true` if the account is a member of the group, `false` otherwise
    #
    def member_of?(group_dn)
      value = false
      dn_components = group_dn.downcase.split(",")
      if dn_components.size > 1
        # The group DN references an LDAP-style group.
        # See if any of the account's group entries is the same as
        # or a child of the DN.
        self.groups.each do |group|
          group_components = group.downcase.split(",")
          if group_components[(-(dn_components.size))..-1] == dn_components
            value = true
          end #if
        end #each
      else
        # The permission references a simple group name.
        # See if any of the account's group entries matches it.
        self.groups.each do |group|
          value = true if group.downcase == dn_components[0]
        end #each
      end #if
      return value
    end

    #
    # Method: preferences
    #
    # Returns an <I3::PreferenceCollection> that provides access to the
    # per-tool preferences that have been stored for this account.
    #
    def preferences
      @preferences = PreferenceCollection.new(self) if @preferences.nil?
      @preferences
    end

    #
    # Method: to_s
    # 
    # Returns a string representation of the account.  The string is built
    # from the account name, followed by the full name in parentheses if'
    # available.
    # 
    def to_s
      str = self.account_name.to_s
      str = '#' + self.id.to_s if str.size == 0  # Use ID if no account name
      if self.person and self.person.full_name.size > 0
        str += ' (' + self.person.full_name + ')'
      end #if
      return str
    end #def

  end #class

  #
  # Data Model: I3::EmailAddress
  #
  # Represents an e-mail address belonging to a person.  E-mail addresses
  # have the following properties:
  # 
  #   user - the user name portion of the address
  #   host - the host address portion of the address
  #   person - the <I3::Person> to whom the address belongs
  #   tag - an optional tag describing the type of address, often provided
  #     by the directory service to classify the address (e.g. "proxy")
  #   display_name - an optional string to use as the human-readable name;
  #     this is normally not used for people with directory entries, as the
  #     person's full name is considered the display name
  #   is_primary? - `true` if the address is the primary contact address
  #     for the person.  Each Person object should have exactly one address
  #     that is marked as primary.
  #
  class EmailAddress < I3::Record

    belongs_to :person

    #
    # Method: to_s
    # 
    # Returns the e-mail address in "user@host" format.
    # 
    def to_s; self.user + "@" + self.host; end

  end #class
  
  #
  # Data Model: I3::Permission
  #
  # Represents an entry in the permissions table.  Permission entries have
  # the following properties:
  # 
  #   tool - the short name of the tool to which the permission applies,
  #     e.g. "bboard"
  #   privilege - the privilege being granted for the tool.  Each tool has
  #     an "access-tool" privilege, and others may be defined in the tool's
  #     `info.yml` file.
  #   is_group? - `true` if the permission applies to a group, in which case
  #     the `group_dn` field specifies a group; otherwise this is `false` and
  #     the `account` field refers to a user account
  #   group_dn - the distinguished name of the group to which the permission
  #     applies, if it is a group permission
  #   account - the <I3::Account> to which the permission applies, if it
  #     is not a group permission
  #   granted_by - the <I3::Account> that granted this privilege to the
  #     group or account
  #   granted_at - the date/time at which the privilege was granted
  #
  class Permission < I3::Record
    belongs_to :account
    belongs_to :granted_by,
               :class_name => "Account",
               :foreign_key => "granted_by_id"
  end #class

  #
  # Data Model: I3::PermissionJournalEntry
  #
  # Represents a journal entry for a change in permissions.  Journal entries
  # are recorded each time a permission is granted or revoked.  Permission
  # journal entries have the following properties:
  # 
  #   account - the <I3::Account> that altered the permission
  #   tool - the short name of the tool to which the permission applies,
  #     e.g. "bboard"
  #   privilege - the privilege that was granted or revoked
  #   text - a description of what occurred
  #   recorded_at - the date/time at which the journal entry was recorded
  #
  class PermissionJournalEntry < I3::Record
    belongs_to :account
  end #class

  #
  # Class:  I3::PreferenceCollection
  # 
  # Represents a collection of per-tool preferences for a user account.
  # The collection may be accessed as a `Hash` (it supports the `Enumerable`
  # interface) or the <get> and <set> methods can be used for more control.
  # 
  # Note that preferences for the current user's account can be easily accessed
  # using the the <I3.preferences> object.
  # 
  class PreferenceCollection
    include Enumerable

    #
    # Private Class Method: new
    # 
    # Initializes a new `PreferenceCollection` instance.
    # 
    # Parameters:
    #   account - the <I3::Account> to which the collection belongs
    # 
    def initialize(account)
      @account = account
      @preferences = Hash.new
    end #def

    #
    # Method: []
    #
    # Alias for <I3::PreferenceCollection::get>.  The current tool is assumed.
    # If the intranet is not currently responding to a CGI request, this will
    # raise an exception; use <I3::PreferenceCollection::get> in this case.
    #
    # Parameters:
    #   key - the key of the user preference to look up
    #
    # Returns:
    #   The stored object, or `nil` if the key could not be found.
    #
    # Raises:
    #   `ArgumentError` if no current tool could be determined
    #   (e.g. the <I3::PreferenceCollection> class is being used in an
    #   interactive session or a non-intranet script).
    #
    def [](key)
      self.get(key)
    end #def
    
    #
    # Method: []=
    #
    # Alias for <I3::PreferenceCollection::set>.  The current tool is assumed.
    # If the intranet is not currently responding to a CGI request, this will
    # raise an exception; use <I3::PreferenceCollection::set> in this case.
    #
    # Parameters:
    #   key - the key of the preference to store
    #   value - the object to store, or `nil` to delete the key/value pair
    #
    # Raises:
    #   `ArgumentError` if no current tool could be determined
    #   (e.g. the <I3::PreferenceCollection> class is being used in an
    #   interactive session or a non-intranet script).
    #
    def []=(key, value)
      self.set(key, value)
    end #def
    
    #
    # Method: get
    #
    # Retrieves an user preference object that has been stored.
    #
    # Parameters:
    #   key - the key of the preference to look up
    #   options - optional; a `Hash` of additional options
    #
    # Returns:
    #   The stored object, or `nil` if the key could not be found.
    #
    # Raises:
    #   `ArgumentError` if the `:tool` option was omitted and no current tool
    #   could be determined (e.g. the <I3::PreferenceCollection> class is being
    #   used in an interactive session or a non-intranet script).
    #
    def get(key, options=nil)
      options = Hash.new if options.nil?
      tool = (options[:tool].nil?) ? self.current_tool_name : options[:tool]
      self.load tool
      rec = @preferences[tool][key]
      return nil if rec.nil?
      return rec.value
    end #def
    
    #
    # Method: set
    #
    # Stores an user preference object.  The object can be any type that
    # can be represented by YAML, including most standard types (numbers,
    # strings, hashes, etc.).
    # 
    # Note that <I3::SharedObject> instances will be converted to `Hash` objects
    # as they are stored, so when the preference is retrieved, it will no longer
    # be an <I3::SharedObject> instance.  For the most predictable results, use
    # the <I3::SharedObject::to_hash> method to convert the shared object before
    # storing it.
    #
    # Parameters:
    #   key - the key of the preference to set
    #   value - the object to store, or `nil` to delete the key/value pair
    #   options - optional; a `Hash` of additional options
    #
    # Raises:
    #   `ArgumentError` if the `:tool` option was omitted and no current tool
    #   could be determined (e.g. the <I3::PreferenceCollection> class is being
    #   used in an interactive session or a non-intranet script).
    #
    def set(key, value, options=nil)
      options = Hash.new if options.nil?
      tool = (options[:tool].nil?) ? self.current_tool_name : options[:tool]
      self.load tool
      rec = @preferences[tool][key]
      if value.nil?
        rec.destroy unless rec.nil?
      else
        if rec.nil?
          rec = Preference.new
          rec.account = @account
          rec.tool = tool
          rec.key = key
        end #if
        rec.value = value
        rec.save
      end #if
      self.reload tool
    end #def

    #
    # Method: each
    #
    # Calls the given block once for each user preference associated with the
    # current tool, passing the key and the associated object to the block as
    # a two-element array.  Because of the assignment semantics of block
    # parameters, these elements will be split out if the block has two formal
    # parameters.
    #
    # Raises:
    #   `ArgumentError` if no current tool could be determined (e.g. the
    #   <I3::PreferenceCollection> class is being used in an interactive session
    #   or a non-intranet script).
    #
    def each
      tool = self.current_tool_name
      self.each_for_tool(tool) { |pair| yield pair }
    end #def

    #
    # Method: each_for_tool
    #
    # Calls the given block once for each user preference associated with the
    # specified tool, passing the key and the associated object to the block as
    # a two-element array.  Because of the assignment semantics of block
    # parameters, these elements will be split out if the block has two formal
    # parameters.
    #
    def each_for_tool(tool)
      self.load tool
      @preferences[tool].each { |key, preference| yield key, preference.value }
    end #def

    #
    # Method: reload
    # 
    # Forces a reload of all preferences for the specified tool, or the
    # current tool if none is specified.
    # 
    # Parameters:
    #   tool - optional; the short name of the tool for which preferences
    #     should be reloaded
    # 
    def reload(tool=nil)
      tool = self.current_tool_name if tool.nil?
      @preferences[tool] = nil
      self.load tool
    end #def
    
    #
    # Private Method: load
    # 
    # Loads the preferences for the specified tool, or the current tool
    # if none is specified.  If the preferences have already been loaded,
    # they will not be loaded again.
    # 
    # Parameters:
    #   tool - optional; the short name of the tool for which preferences
    #     should be reloaded
    # 
    def load(tool=nil)
      tool = self.current_tool_name if tool.nil?
      if @preferences[tool].nil?
        @preferences[tool] = Hash.new
        preference_records = Preference.find(:all, :conditions => [
          "account_id = ? AND tool = ?", @account.id, tool
        ])
        preference_records.each { |rec| @preferences[tool][rec.key] = rec }
      end #if
      true
    end #def

    #
    # Private Method: current_tool_name
    # 
    # Returns the (short) name of the tool that is currently being accessed,
    # e.g. "bboard".
    # 
    # Raises:
    #   `ArgumentError` if no current tool could be determined (e.g. the
    #   <I3::PreferenceCollection> class is being used in an interactive session
    #   or a non-intranet script).
    # 
    def current_tool_name
      tool = I3.config.tools.current
      if tool.nil?
        raise ArgumentError,
          "No tool was specified and no default tool can be determined."
      end #if
      tool.dir
    end #def
    
  end #class

  #
  # Class (Hidden):  I3::Preference
  # 
  # Represents a saved user preference.  This is used internally by
  # <I3::PreferenceCollection> to access preference records in the database.
  # Preferences have the following properties:
  # 
  #   account - the <I3::Account> to whom the preference belongs
  #   tool - the short name of the tool to which the preference applies,
  #     e.g. "bboard"
  #   key - the string identifier for the preference
  #   value - the object associated with the key
  #   updated_at - the date/time at which the preference was last updated
  # 
  class Preference < I3::Record
    belongs_to :account
    serialize :value
  end #class
  
end #module
