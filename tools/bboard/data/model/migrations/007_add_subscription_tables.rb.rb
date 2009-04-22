#
# Migration: bboard/data/model/migrations/007_add_subscription_tables
#
# TODO - Place a description for your migration here.
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
#   $Id: 007_add_subscription_tables.rb.rb 70 2008-03-26 16:14:40Z nmellis $
#

#
# Class: AddSubscriptionTables
#
class AddSubscriptionTables < ActiveRecord::Migration
  
  #
  # Class Method: up
  #
  # Updates the database to the new version.
  #
  def self.up
    
    create_table :subscriber_extensions do |t|
      t.column :subscriber_id, :integer
      t.column :email_format, :string
      t.column :email_frequency, :string
    end #create_table
    
    create_table :subscriptions do |t|
      t.column :subscriber_id, :integer
      t.column :topic_id, :integer
      t.column :article_id, :integer
    end #create_table
    
  end #def
  
  #
  # Class Method: down
  #
  # Reverts the database to the previous version.
  #
  def self.down
    drop_table :subscriber_extensions
    drop_table :subscriptions
  end #def

end #class
