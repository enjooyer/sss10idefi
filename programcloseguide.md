Solana Program Close & SOL Recovery Instructions
Deploying a smart contract on Solana requires storing the executable code directly on the blockchain, which comes with a massive "Rent Exemption" requirement (typically ~2.5 to 3.5 SOL depending on the size of the compiled .so file).

The good news is that you can recover 100% of this SOL when you no longer need the program, or if a deployment fails.

Here is exactly how you do it using the Solana CLI. You can run these commands directly in the Terminal tab of Solana Playground (beta.solpg.io), or in your local terminal if you have the Solana Tool Suite installed and your keypair configured.

1. Recovering SOL from a FAILED Deployment
   When a deployment fails with an error like Insufficient funds but your SOL is already gone (dropping from 5 SOL to 1.5 SOL), the network actually successfully created a temporary "Buffer Account" and stored your SOL there, but it failed to finalize the transfer into a permanent "Program Account."

This happens when network congestion drops the final transaction. Your SOL is perfectly safe inside the buffer.

How to get the 3.5 SOL back from the buffer right now:
Open the Terminal in Solana Playground.
Make sure you are connected to Mainnet (check the bottom left corner).
Type the following command to see your stuck buffer accounts:
bash
solana program show --buffers
You will see a list of buffer addresses and the SOL trapped inside them.
To automatically close all your buffers and instantly refund the SOL back to your main wallet, run:
bash
solana program close --buffers
Hit Enter, and check your wallet balance. You should instantly have your ~5 SOL back!

2. Closing the Entire Active Protocol (1 Year From Now)
   When the 1-year emission period is over, users have withdrawn their LP tokens, the unwrapping is finished, and you want to shut down "Facility Sieben" forever, you can close the actual program and reclaim the ~3 SOL.

⚠️ WARNING: Closing a program is irreversible. Once closed, the program ID is destroyed forever, and any user who tries to interact with your protocol via the frontend will receive an error. Do not do this while users still have funds staked!

Step 1: Ensure Users Have Withdrawn
Do not rug-pull your users. Before closing the program, wait until everyone has utilized the
withdraw_lp
or
emergency_withdraw
functions to retrieve their capital from the vaults.

Step 2: Recover the Treasury
Use your admin functions (or the
admin_recover_tokens
instruction) to sweep any remaining SSS10i tokens and NFTs out of the Treasury PDA back to your admin wallet.

Step 3: Close the Program and Reclaim the SOL
You must have the "Upgrade Authority" keypair that deployed the program (this is the keypair inside your Solana Playground).

Open the Terminal in Solana Playground.
Set the cluster to Mainnet:
bash
solana config set --url mainnet-beta
Run the close command using your Program ID:
bash
solana program close YOUR_PROGRAM_ID_HERE
(Replace YOUR_PROGRAM_ID_HERE with the actual Mainnet Program ID).

Step 4: Verify the Refund
The terminal will output a success message showing that the program was closed and ~3 SOL was transferred back to your authority wallet.

FAQ
What if I close it accidentally? You cannot undo it. To restart the protocol, you would have to deploy from scratch, which will generate a completely new Program ID. You would then need to update the frontend to point to the new Program ID, and users would have to start over in the new contract state.

Does closing the program close the SPL Tokens and NFTs? No. The $SSS10i, $CARDANO, and Artifact NFTs are standard SPL tokens that live on their own. Closing your Yield Farming program only destroys the logic that handles Staking/Harvesting/Wrapping. The tokens themselves will continue to exist in users' wallets undisturbed.
