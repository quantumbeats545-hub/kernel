import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KernelToken } from "../target/types/kernel_token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";

describe("kernel-token", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KernelToken as Program<KernelToken>;
  const connection = provider.connection;

  // Test accounts
  let tokenMint: PublicKey;
  let authority: Keypair;
  let user1: Keypair;
  let user2: Keypair;

  // PDAs
  let configPda: PublicKey;
  let stakingVaultPda: PublicKey;
  let reflectionPoolPda: PublicKey;

  // Token accounts
  let authorityTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;

  // Test constants
  const INITIAL_MINT_AMOUNT = 1_000_000_000 * 10 ** 9; // 1B tokens
  const REFLECTION_BPS = 200; // 2%
  const LP_BPS = 200; // 2%
  const BURN_BPS = 100; // 1%

  before(async () => {
    // Generate test keypairs
    authority = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Airdrop SOL to test accounts
    const airdropAmount = 10 * LAMPORTS_PER_SOL;

    await Promise.all([
      connection.requestAirdrop(authority.publicKey, airdropAmount),
      connection.requestAirdrop(user1.publicKey, airdropAmount),
      connection.requestAirdrop(user2.publicKey, airdropAmount),
    ]);

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create Token-2022 mint
    tokenMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      9, // decimals
      Keypair.generate(),
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Token Mint:", tokenMint.toBase58());

    // Derive PDAs
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), tokenMint.toBuffer()],
      program.programId
    );

    [stakingVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_vault"), tokenMint.toBuffer()],
      program.programId
    );

    [reflectionPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reflection_pool"), tokenMint.toBuffer()],
      program.programId
    );

    console.log("Config PDA:", configPda.toBase58());
    console.log("Staking Vault PDA:", stakingVaultPda.toBase58());
    console.log("Reflection Pool PDA:", reflectionPoolPda.toBase58());

    // Create token accounts
    authorityTokenAccount = await createAssociatedTokenAccount(
      connection,
      authority,
      tokenMint,
      authority.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    user1TokenAccount = await createAssociatedTokenAccount(
      connection,
      authority,
      tokenMint,
      user1.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    user2TokenAccount = await createAssociatedTokenAccount(
      connection,
      authority,
      tokenMint,
      user2.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    // Mint initial tokens
    await mintTo(
      connection,
      authority,
      tokenMint,
      authorityTokenAccount,
      authority,
      BigInt(INITIAL_MINT_AMOUNT),
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    // Transfer tokens to users
    const userAmount = 100_000_000 * 10 ** 9; // 100M each

    // Use SPL transfer for user distributions
    const { createTransferInstruction } = await import("@solana/spl-token");

    const tx = new anchor.web3.Transaction();
    tx.add(
      createTransferInstruction(
        authorityTokenAccount,
        user1TokenAccount,
        authority.publicKey,
        BigInt(userAmount),
        [],
        TOKEN_2022_PROGRAM_ID
      ),
      createTransferInstruction(
        authorityTokenAccount,
        user2TokenAccount,
        authority.publicKey,
        BigInt(userAmount),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [authority]);

    console.log("Setup complete!");
  });

  describe("Initialize", () => {
    it("initializes the program correctly", async () => {
      const tx = await program.methods
        .initialize(REFLECTION_BPS, LP_BPS, BURN_BPS)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          stakingVault: stakingVaultPda,
          reflectionPool: reflectionPoolPda,
          config: configPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Initialize tx:", tx);

      // Verify config
      const config = await program.account.kernelConfig.fetch(configPda);

      assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
      assert.equal(config.tokenMint.toBase58(), tokenMint.toBase58());
      assert.equal(config.reflectionShareBps, REFLECTION_BPS);
      assert.equal(config.lpShareBps, LP_BPS);
      assert.equal(config.burnShareBps, BURN_BPS);
      assert.equal(config.totalStaked.toNumber(), 0);
      assert.equal(config.isPaused, false);
    });

    it("fails with invalid fee configuration", async () => {
      // Create a new mint for this test
      const newMint = await createMint(
        connection,
        authority,
        authority.publicKey,
        null,
        9,
        Keypair.generate(),
        { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );

      const [newConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newMint.toBuffer()],
        program.programId
      );

      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("staking_vault"), newMint.toBuffer()],
        program.programId
      );

      const [newPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reflection_pool"), newMint.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .initialize(100, 100, 100) // Total 300, should be 500
          .accounts({
            authority: authority.publicKey,
            tokenMint: newMint,
            stakingVault: newVaultPda,
            reflectionPool: newPoolPda,
            config: newConfigPda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("InvalidFeeConfig");
      }
    });
  });

  describe("Staking", () => {
    const STAKE_AMOUNT = new anchor.BN(1_000_000 * 10 ** 9); // 1M tokens

    it("allows user to stake tokens", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const balanceBefore = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .stake(STAKE_AMOUNT)
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          stakingVault: stakingVaultPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log("Stake tx:", tx);

      // Verify user stake
      const userStake = await program.account.userStake.fetch(userStakePda);
      assert.equal(userStake.owner.toBase58(), user1.publicKey.toBase58());
      assert.equal(userStake.stakedAmount.toNumber(), STAKE_AMOUNT.toNumber());

      // Verify token balance decreased
      const balanceAfter = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      assert.equal(
        Number(balanceBefore.amount) - Number(balanceAfter.amount),
        STAKE_AMOUNT.toNumber()
      );

      // Verify vault balance increased
      const vaultBalance = await getAccount(
        connection,
        stakingVaultPda,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(Number(vaultBalance.amount), STAKE_AMOUNT.toNumber());

      // Verify global config updated
      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.totalStaked.toNumber(), STAKE_AMOUNT.toNumber());
    });

    it("fails to stake zero amount", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .stake(new anchor.BN(0))
          .accounts({
            owner: user2.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user2TokenAccount,
            stakingVault: stakingVaultPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user2])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("ZeroAmount");
      }
    });

    it("allows additional staking", async () => {
      const additionalAmount = new anchor.BN(500_000 * 10 ** 9); // 500K more

      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const stakeBefore = await program.account.userStake.fetch(userStakePda);

      await program.methods
        .stake(additionalAmount)
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          stakingVault: stakingVaultPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const stakeAfter = await program.account.userStake.fetch(userStakePda);
      assert.equal(
        stakeAfter.stakedAmount.toNumber(),
        stakeBefore.stakedAmount.toNumber() + additionalAmount.toNumber()
      );
    });
  });

  describe("Unstaking", () => {
    it("allows user to unstake tokens", async () => {
      const unstakeAmount = new anchor.BN(500_000 * 10 ** 9); // 500K tokens

      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const stakeBefore = await program.account.userStake.fetch(userStakePda);
      const balanceBefore = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .unstake(unstakeAmount)
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          stakingVault: stakingVaultPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      console.log("Unstake tx:", tx);

      // Verify stake decreased
      const stakeAfter = await program.account.userStake.fetch(userStakePda);
      assert.equal(
        stakeAfter.stakedAmount.toNumber(),
        stakeBefore.stakedAmount.toNumber() - unstakeAmount.toNumber()
      );

      // Verify balance increased
      const balanceAfter = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(
        Number(balanceAfter.amount) - Number(balanceBefore.amount),
        unstakeAmount.toNumber()
      );
    });

    it("fails to unstake more than staked", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const stake = await program.account.userStake.fetch(userStakePda);
      const tooMuch = stake.stakedAmount.add(new anchor.BN(1));

      try {
        await program.methods
          .unstake(tooMuch)
          .accounts({
            owner: user1.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user1TokenAccount,
            stakingVault: stakingVaultPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("InsufficientStake");
      }
    });
  });

  describe("Reflections", () => {
    it("deposits reflections to pool", async () => {
      const depositAmount = new anchor.BN(100_000 * 10 ** 9); // 100K tokens

      const tx = await program.methods
        .depositReflections(depositAmount)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          authorityTokenAccount,
          reflectionPool: reflectionPoolPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      console.log("Deposit reflections tx:", tx);

      // Verify reflection pool balance
      const poolBalance = await getAccount(
        connection,
        reflectionPoolPda,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(Number(poolBalance.amount), depositAmount.toNumber());

      // Verify config updated
      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.pendingReflections.toNumber(), depositAmount.toNumber());
      assert.isTrue(config.accumulatedPerShare.gt(new anchor.BN(0)));
    });

    it("allows staker to claim reflections", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const balanceBefore = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .claimReflections()
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          reflectionPool: reflectionPoolPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      console.log("Claim reflections tx:", tx);

      // Verify balance increased (received reflections)
      const balanceAfter = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.isTrue(Number(balanceAfter.amount) > Number(balanceBefore.amount));

      // Verify user stake updated
      const userStake = await program.account.userStake.fetch(userStakePda);
      assert.isTrue(userStake.totalClaimed.gt(new anchor.BN(0)));
      assert.equal(userStake.pendingRewards.toNumber(), 0);
    });

    it("fails to claim when nothing to claim", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .claimReflections()
          .accounts({
            owner: user1.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user1TokenAccount,
            reflectionPool: reflectionPoolPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("NothingToClaim");
      }
    });
  });

  describe("Burn", () => {
    it("burns tokens", async () => {
      const burnAmount = new anchor.BN(50_000 * 10 ** 9); // 50K tokens

      const [burnRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("burn"), configPda.toBuffer()],
        program.programId
      );

      const supplyBefore = await getMint(
        connection,
        tokenMint,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .burnTokens(burnAmount)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          authorityTokenAccount,
          burnRecord: burnRecordPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Burn tx:", tx);

      // Verify supply decreased
      const supplyAfter = await getMint(
        connection,
        tokenMint,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(
        Number(supplyBefore.supply) - Number(supplyAfter.supply),
        burnAmount.toNumber()
      );

      // Verify burn record
      const burnRecord = await program.account.burnRecord.fetch(burnRecordPda);
      assert.equal(burnRecord.totalBurned.toNumber(), burnAmount.toNumber());
      assert.equal(burnRecord.burnCount.toNumber(), 1);
    });
  });

  describe("Admin Functions", () => {
    it("pauses and unpauses the program", async () => {
      // Pause
      await program.methods
        .setPaused(true)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority])
        .rpc();

      let config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.isPaused, true);

      // Try to stake while paused
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .stake(new anchor.BN(1000))
          .accounts({
            owner: user2.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user2TokenAccount,
            stakingVault: stakingVaultPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user2])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("ProgramPaused");
      }

      // Unpause
      await program.methods
        .setPaused(false)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority])
        .rpc();

      config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.isPaused, false);
    });

    it("updates fee configuration", async () => {
      const newReflection = 250; // 2.5%
      const newLp = 150; // 1.5%
      const newBurn = 100; // 1%

      await program.methods
        .updateFees(newReflection, newLp, newBurn)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.reflectionShareBps, newReflection);
      assert.equal(config.lpShareBps, newLp);
      assert.equal(config.burnShareBps, newBurn);

      // Reset to original
      await program.methods
        .updateFees(REFLECTION_BPS, LP_BPS, BURN_BPS)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority])
        .rpc();
    });

    it("transfers authority", async () => {
      const newAuthority = Keypair.generate();

      // Airdrop SOL to new authority
      await connection.requestAirdrop(newAuthority.publicKey, LAMPORTS_PER_SOL);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await program.methods
        .transferAuthority(newAuthority.publicKey)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority])
        .rpc();

      let config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.authority.toBase58(), newAuthority.publicKey.toBase58());

      // Transfer back
      await program.methods
        .transferAuthority(authority.publicKey)
        .accounts({
          authority: newAuthority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([newAuthority])
        .rpc();

      config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
    });

    it("prevents non-authority from admin functions", async () => {
      try {
        await program.methods
          .setPaused(true)
          .accounts({
            authority: user1.publicKey,
            tokenMint,
            config: configPda,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("NotAuthority");
      }
    });
  });

  describe("Airdrop Registration", () => {
    it("registers airdrop", async () => {
      const [airdropStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("airdrop"), configPda.toBuffer()],
        program.programId
      );

      const recipients = [user1.publicKey, user2.publicKey];
      const amountPerRecipient = new anchor.BN(1000 * 10 ** 9); // 1000 tokens each

      const tx = await program.methods
        .airdrop(recipients, amountPerRecipient)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          airdropState: airdropStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Airdrop registration tx:", tx);

      const airdropState = await program.account.airdropState.fetch(airdropStatePda);
      assert.equal(
        airdropState.totalAirdropped.toNumber(),
        amountPerRecipient.toNumber() * recipients.length
      );
      assert.equal(airdropState.recipientCount.toNumber(), recipients.length);
    });
  });
});
