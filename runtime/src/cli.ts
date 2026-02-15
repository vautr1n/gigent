#!/usr/bin/env node

/**
 * Gigent Agent Runtime -- CLI
 *
 * Commands:
 *   init    -- Generate a gigent-agent.yaml template
 *   run     -- Start the agent runtime daemon
 *   status  -- Show current agent status
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeEngine } from './engine';

const program = new Command();

program
  .name('gigent-runtime')
  .description('Gigent Agent Runtime -- Run autonomous AI agents on the Gigent marketplace')
  .version('0.1.0');

// ─── init ───
program
  .command('init')
  .description('Generate a gigent-agent.yaml template in the current directory')
  .option('-f, --force', 'Overwrite existing config file')
  .action((opts) => {
    const targetPath = path.resolve(process.cwd(), 'gigent-agent.yaml');

    if (fs.existsSync(targetPath) && !opts.force) {
      console.error(`Error: gigent-agent.yaml already exists.`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }

    // Copy template
    const templatePath = path.resolve(__dirname, 'config', 'template.yaml');

    // If running from dist/, the template might be at a different location
    // In dev mode (ts-node), it's at src/config/template.yaml
    let templateContent: string;

    if (fs.existsSync(templatePath)) {
      templateContent = fs.readFileSync(templatePath, 'utf-8');
    } else {
      // Fallback: try the source path
      const srcTemplatePath = path.resolve(__dirname, '..', 'src', 'config', 'template.yaml');
      if (fs.existsSync(srcTemplatePath)) {
        templateContent = fs.readFileSync(srcTemplatePath, 'utf-8');
      } else {
        console.error('Error: Could not find template.yaml');
        process.exit(1);
      }
    }

    fs.writeFileSync(targetPath, templateContent);
    console.log('Created gigent-agent.yaml');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit gigent-agent.yaml with your agent config');
    console.log('  2. Set your owner wallet address');
    console.log('  3. Set your LLM provider API key');
    console.log('  4. Run: gigent-runtime run');

    // Also create .gitignore if not exists
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    const gitignoreEntries = ['.gigent-credentials', '.env', 'node_modules/'];

    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, gitignoreEntries.join('\n') + '\n');
      console.log('');
      console.log('Created .gitignore (excludes .gigent-credentials)');
    } else {
      const existing = fs.readFileSync(gitignorePath, 'utf-8');
      const missing = gitignoreEntries.filter((e) => !existing.includes(e));
      if (missing.length > 0) {
        fs.appendFileSync(gitignorePath, '\n' + missing.join('\n') + '\n');
        console.log('');
        console.log('Updated .gitignore with: ' + missing.join(', '));
      }
    }
  });

// ─── run ───
program
  .command('run')
  .description('Start the agent runtime daemon')
  .option('-c, --config <path>', 'Path to gigent-agent.yaml')
  .option('-u, --url <url>', 'Backend API URL (default: http://localhost:3000)')
  .action(async (opts) => {
    const engine = new RuntimeEngine(opts.config, opts.url);

    try {
      await engine.start();

      // Keep the process alive
      // The engine sets up SIGINT/SIGTERM handlers internally
    } catch (err: any) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(1);
    }
  });

// ─── status ───
program
  .command('status')
  .description('Show agent status information')
  .option('-c, --config <path>', 'Path to gigent-agent.yaml')
  .option('-u, --url <url>', 'Backend API URL (default: http://localhost:3000)')
  .action(async (opts) => {
    const engine = new RuntimeEngine(opts.config, opts.url);

    try {
      const status = await engine.getStatus();

      console.log('');
      console.log('Gigent Agent Runtime Status');
      console.log('==========================');
      console.log(`  Agent Name:    ${status.agent_name}`);
      console.log(`  Agent ID:      ${status.agent_id || '(not registered)'}`);
      console.log(`  Running:       ${status.is_running ? 'Yes' : 'No'}`);
      console.log(`  Active Orders: ${status.active_orders}`);
      console.log(`  Gigs Config:   ${status.gigs_configured}`);
      console.log(`  Backend URL:   ${status.base_url}`);

      if (status.uptime_seconds > 0) {
        const hours = Math.floor(status.uptime_seconds / 3600);
        const minutes = Math.floor((status.uptime_seconds % 3600) / 60);
        const seconds = status.uptime_seconds % 60;
        console.log(`  Uptime:        ${hours}h ${minutes}m ${seconds}s`);
      }

      console.log('');

      // If agent is registered, fetch live info from backend
      if (status.agent_id) {
        try {
          const res = await fetch(`${status.base_url}/api/agents/${status.agent_id}`);
          if (res.ok) {
            const agent = (await res.json()) as any;
            console.log('Live Agent Info (from backend):');
            console.log(`  Status:        ${agent.status}`);
            console.log(`  Wallet:        ${agent.wallet_address}`);
            console.log(`  Rating:        ${agent.rating_avg}/5 (${agent.rating_count} reviews)`);
            console.log(`  Earnings:      $${agent.total_earnings} USDC`);
            console.log(`  Orders Done:   ${agent.total_orders_completed}`);

            if (agent.gigs && agent.gigs.length > 0) {
              console.log(`  Active Gigs:   ${agent.gigs.length}`);
              for (const gig of agent.gigs) {
                console.log(`    - "${gig.title}" ($${gig.price_basic})`);
              }
            }

            if (agent.is_online !== undefined) {
              console.log(`  Online:        ${agent.is_online ? 'Yes' : 'No'}`);
            }
          }
        } catch {
          console.log('  (Could not connect to backend for live info)');
        }
        console.log('');
      }
    } catch (err: any) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(1);
    }
  });

program.parse();
