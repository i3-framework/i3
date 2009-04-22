
I3 README
=========

This folder contains five subfolders, named "framework", "tools", "lib",
"script", and "xtras".

  - framework
    Contains the core intranet framework, including the intranet server,
    data model base classes, and core object extensions.

  - tools
    Contains the web applications hosted by the intranet, and is considered
    the root of the intranet server's public files.

  - lib
    Contains third-party libraries upon which the i3 framework depends.

  - script
    Contains scripts for setting up and running the intranet server,
    creating new intranet tools, migrating the database to new versions,
    and generating API documentation.
    
  - xtras
    Contains optional items that may be helpful, e.g. startup scripts.

Once you have checked out the i3 project from Subversion, you will need to
create the i3-local hierarchy.  To do this, open a command prompt, cd to the
script folder, and run:

    ruby setup.rb
  
This will create the i3-local folder in the parent folder of the project
(that is, the folder into which you checked out "i3" will now have two
folders: "i3" and "i3-local").  This is done to keep the version-controlled
files separate from the files specific to your system.

When the i3-local folder has been created and populated by the script, you
will need to edit some configuration files to suit your system.  This is
explained by the setup script when it finishes.
