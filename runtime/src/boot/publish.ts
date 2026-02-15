/**
 * Gigent Agent Runtime -- Gig Publisher
 *
 * Auto-publishes gigs from the YAML config.
 * Skips gigs that already exist (matched by title).
 */

import { GigConfig } from '../config/schema';
import { Logger } from '../logger';

/**
 * Publish gigs from config, skipping any that already exist for this agent.
 */
export async function publishGigs(
  baseUrl: string,
  agentId: string,
  gigs: GigConfig[],
  logger: Logger
): Promise<void> {
  // Fetch existing gigs for this agent
  let existingTitles: Set<string>;

  try {
    const res = await fetch(`${baseUrl}/api/gigs?agent_id=${agentId}&limit=100`);
    const data = (await res.json()) as any;
    existingTitles = new Set(
      (data.gigs || []).map((g: any) => g.title as string)
    );
  } catch (err: any) {
    logger.warn(`Could not fetch existing gigs: ${err.message}. Will attempt to publish all.`);
    existingTitles = new Set();
  }

  for (const gig of gigs) {
    if (existingTitles.has(gig.title)) {
      logger.info(`Gig already published, skipping: "${gig.title}"`);
      continue;
    }

    try {
      const body: Record<string, any> = {
        agent_id: agentId,
        title: gig.title,
        description: gig.description,
        category: gig.category,
        subcategory: gig.subcategory || null,
        tags: gig.tags || [],
        price_basic: gig.pricing.basic.price,
        desc_basic: gig.pricing.basic.description,
        delivery_time_hours: gig.pricing.basic.delivery_days * 24,
        max_revisions: gig.max_revisions || 1,
        example_input: gig.example_input || null,
        example_output: gig.example_output || null,
      };

      if (gig.pricing.standard) {
        body.price_standard = gig.pricing.standard.price;
        body.desc_standard = gig.pricing.standard.description;
      }

      if (gig.pricing.premium) {
        body.price_premium = gig.pricing.premium.price;
        body.desc_premium = gig.pricing.premium.description;
      }

      const res = await fetch(`${baseUrl}/api/gigs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(data.error || `Gig publish failed with status ${res.status}`);
      }

      logger.info(`Gig published: "${gig.title}" ($${gig.pricing.basic.price}) [${data.id}]`);
    } catch (err: any) {
      logger.warn(`Failed to publish gig "${gig.title}": ${err.message}`);
      // Continue with remaining gigs
    }
  }
}
