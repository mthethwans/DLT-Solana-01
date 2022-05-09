# JS-Client Setup
## Install Depedencies
It is assumed that nodejs is already installed.

1. Download/Clone repository to your home directory: **git clone https://github.com/mthethwans/DLT-Solana-01.git**
3. Navigate to js-client directory: **cd js-client**
4. Run **npm install**

                                                              OR

Install dependencies using npm
1. npm install --save @solana/web3.js
2. npm install @solana/buffer-layout@3.0.0
3. npm i --save borsh
4. npm i --save mz
5. npm install --save yaml@1.10.2

## Setup babel
1. Install baberc: **npm install --save-dev @babel/cli @babel/core @babel/preset-env**

# Solana Program Setup
Assumed rust is installed. Download the repository:
1. Navigate to the solana-program directory: **cd solana-program**
2. Build the project: **cargo build-bpf**
3. It is noted that when you build the project two files we created.
4. Both files are located under **target/deploy/** directory. solana_program.so and solana_program-keypair.json files were created.
5. Copy the file paths and save them somewhere. The terminal also shows you how you can deploy your program copy that command cause you will need it later.

# Network Setup
Solana maintains several different clusters with different purposes. We will be setting up the local cluster in this example.

1. Run **solana config set --url localhost** : This command setup the local cluster and generates *.config/solana/cli/config.yml* in the home directory.
2. Run **solana-test-validator**
3. Run **solana logs**

# Deploy the Solana Program
1. Use the command **solana program deploy ~/DLT-Solana-01/solana-program/target/deploy/solana_program.so**
2. In case there is no enough funds to deploy the program, airdrop some amount of SOL on the account using the public key: 
3. **solana airdrop [amount-in-sol] [public-key] --url localhost**

# Run the Client
1. **cd js-client**
2. Run: **npm start** 
