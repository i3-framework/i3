
Launch Daemons
==============

This folder contains sample items that can be placed in
the /Library/LaunchDaemons folder on Mac OS X.  The paths
may need to be modified to suit your configuration after
being copied.  See the manual pages for `launchctl` and
`launchd.plist` for more details on launch daemons.

- org.maf.intranet.mongrel.plist:
  Starts the Mongrel service to handle intranet requests.

- org.maf.intranet.jobs.plist:
  Runs automated intranet jobs at scheduled intervals
  to update the database and cached objects.  This should
  only be run on installations that have their own databases
  (e.g. the shared development and production servers).

