# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = "ubuntu/vivid64"

  config.vm.network "forwarded_port", guest: 8000, host: 8080

  # Share an additional folder to the guest VM. The first argument is
  # the path on the host to the actual folder. The second argument is
  # the path on the guest to mount the folder. And the optional third
  # argument is a set of non-required options.
  # config.vm.synced_folder "../data", "/vagrant_data"

  config.vm.provision "shell", inline: <<-SHELL
    PROVISIONED="PROVISIONED";

    if [[ -f $PROVISIONED ]]; then
      echo "Skipping provisioning";
      exit;
    else
      echo "Provisioning";
    fi

    sudo apt-get update
    sudo apt-get install -y mongodb bundler nodejs npm
    sudo ln -s /usr/bin/nodejs /usr/local/bin/node
    npm install -g bower
    git clone https://github.com/educoder/DrowsyDromedary.git
    cd DrowsyDromedary
    cp config.example.yaml config.yaml
    bundle install

    cd ..
    git clone https://github.com/educoder/WakefulWeasel.git
    cd WakefulWeasel
    npm install
    sed 's/your.server.com/127.0.0.1/' config.json.example > config.json
    
    cd /vagrant
    npm install
    bower install --config.interactive=false

    cd ~
    touch $PROVISIONED;
  SHELL

  config.vm.provision "shell", run: "always", inline: <<-SHELL
    cd DrowsyDromedary
    bundle exec rackup &
    cd ..
    cd WakefulWeasel
    node weasel.js &
    cd /vagrant
    python -m SimpleHTTPServer
  SHELL
end
