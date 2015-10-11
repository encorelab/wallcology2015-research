# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = "ubuntu/vivid64"

  config.vm.network "forwarded_port", guest: 8000, host: 8080 # web server
  config.vm.network "forwarded_port", guest: 9292, host: 9292 # Drowsy
  config.vm.network "forwarded_port", guest: 7890, host: 7890 # Wakeful

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

    curl --silent --location https://deb.nodesource.com/setup_4.x | bash -
    apt-get install -y mongodb bundler nodejs g++
    ln -s /usr/bin/nodejs /usr/local/bin/node
    npm install -g bower --unsafe-perm
    git clone https://github.com/educoder/DrowsyDromedary.git
    cd DrowsyDromedary
    cp config.example.yaml config.yaml
    bundle install

    cd ..
    git clone https://github.com/educoder/WakefulWeasel.git
    cd WakefulWeasel
    npm install --unsafe-perm
    sed -e 's/your.server.com/127.0.0.1/' -e 's/8080/9292/' config.json.example > config.json
    
    cd /vagrant
    mkdir /main_node_modules
    ln -s /main_node_modules node_modules
    npm install --unsafe-perm
    bower install --config.interactive=false --allow-root
    cp config.local.json config.json
    mongoimport --db wallcology2015-ben --collection users scaffolding/pupils-ben.json --jsonArray
    mongoimport --db wallcology2015-mike --collection users scaffolding/pupils-mike.json --jsonArray
    mongoimport --db wallcology2015-test --collection users scaffolding/pupils-test.json --jsonArray
    mongoimport --db wallcology2015-ben --collection states scaffolding/state.json --jsonArray
    mongoimport --db wallcology2015-mike --collection states scaffolding/state.json --jsonArray
    mongoimport --db wallcology2015-test --collection states scaffolding/state.json --jsonArray

    cd ~
    touch $PROVISIONED;
  SHELL

  config.vm.provision "shell", run: "always", inline: <<-SHELL
    cd DrowsyDromedary
    nohup bundle exec rackup  0<&- &>/tmp/drowsy.log &
    cd ..
    cd WakefulWeasel
    nohup node weasel.js  0<&- &>/tmp/weasel.log &
    cd /vagrant
    nohup python -m SimpleHTTPServer  0<&- &>/tmp/server.log &
  SHELL
end
