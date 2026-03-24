/**
 * Plugin Registry API
 * 
 * GET  /api/v1/plugins         — List all plugins (catalog + installed status)
 * POST /api/v1/plugins         — Install a plugin
 * 
 * Query params:
 *   ?category=import|analysis|action|export|ai
 *   ?installed=true|false
 *   ?slug=kindle-importer      — Get a single plugin's details
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { buildStoreCatalog, getPluginManifest, PLUGIN_MANIFESTS } from '@/server/plugins/registry';
import type { PluginStatus } from '@/server/plugins/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const installed = searchParams.get('installed');
    const slug = searchParams.get('slug');

    // ─── Single plugin detail ─────────────────────────────────
    if (slug) {
      const manifest = getPluginManifest(slug);
      if (!manifest) {
        return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
      }

      // Check if installed
      const [dbRecord] = await db
        .select()
        .from(schema.plugins)
        .where(eq(schema.plugins.slug, slug))
        .limit(1);

      return NextResponse.json({
        ...manifest,
        installed: !!dbRecord,
        status: dbRecord?.status || null,
        config: dbRecord?.config || {},
        installedAt: dbRecord?.installedAt || null,
        lastError: dbRecord?.lastError || null,
      });
    }

    // ─── Full catalog ─────────────────────────────────────────
    
    // Get all installed plugins from DB
    const installedPlugins = await db.select().from(schema.plugins);
    const installedMap = new Map(
      installedPlugins.map((p) => [p.slug, { status: p.status, config: p.config as Record<string, unknown> }])
    );

    // Build catalog
    let catalog = buildStoreCatalog(installedMap);

    // Filter by category
    if (category) {
      catalog = catalog.filter((p) => p.category === category);
    }

    // Filter by installed status
    if (installed === 'true') {
      catalog = catalog.filter((p) => p.installed);
    } else if (installed === 'false') {
      catalog = catalog.filter((p) => !p.installed);
    }

    // Sort: featured first, then alphabetical
    catalog.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.name.localeCompare(b.name);
    });

    // Count summary
    const summary = {
      total: Object.keys(PLUGIN_MANIFESTS).length,
      installed: installedPlugins.length,
      active: installedPlugins.filter((p) => p.status === 'active').length,
      byCategory: {
        import: catalog.filter((p) => p.category === 'import').length,
        analysis: catalog.filter((p) => p.category === 'analysis').length,
        action: catalog.filter((p) => p.category === 'action').length,
        export: catalog.filter((p) => p.category === 'export').length,
        ai: catalog.filter((p) => p.category === 'ai').length,
      },
    };

    return NextResponse.json({ plugins: catalog, summary });
  } catch (err) {
    console.error('Plugin list error:', err);
    return NextResponse.json({ error: 'Failed to fetch plugins' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, slug, config } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Plugin slug is required' }, { status: 400 });
    }

    const manifest = getPluginManifest(slug);
    if (!manifest) {
      return NextResponse.json({ error: `Unknown plugin: ${slug}` }, { status: 404 });
    }

    switch (action) {
      // ─── INSTALL ──────────────────────────────────────────
      case 'install': {
        // Check if already installed
        const [existing] = await db
          .select()
          .from(schema.plugins)
          .where(eq(schema.plugins.slug, slug))
          .limit(1);

        if (existing) {
          return NextResponse.json({ error: 'Plugin already installed', plugin: existing }, { status: 409 });
        }

        // Install
        const [installed] = await db
          .insert(schema.plugins)
          .values({
            slug: manifest.slug,
            name: manifest.name,
            description: manifest.description,
            version: manifest.version,
            type: manifest.type,
            status: 'active',
            icon: manifest.icon,
            category: manifest.category,
            author: manifest.author,
            config: config || manifest.ui?.settingsSchema?.reduce((acc, field) => {
              if (field.default !== undefined) acc[field.key] = field.default;
              return acc;
            }, {} as Record<string, unknown>) || {},
            metadata: {
              capabilities: manifest.capabilities,
              hooks: manifest.hooks,
              routes: manifest.routes,
              mcpTools: manifest.mcpTools,
            },
          })
          .returning();

        return NextResponse.json({ 
          message: `${manifest.name} installed successfully`,
          plugin: installed,
        }, { status: 201 });
      }

      // ─── UNINSTALL ────────────────────────────────────────
      case 'uninstall': {
        const [deleted] = await db
          .delete(schema.plugins)
          .where(eq(schema.plugins.slug, slug))
          .returning();

        if (!deleted) {
          return NextResponse.json({ error: 'Plugin not installed' }, { status: 404 });
        }

        return NextResponse.json({ 
          message: `${manifest.name} uninstalled successfully`,
        });
      }

      // ─── ENABLE ───────────────────────────────────────────
      case 'enable': {
        const [updated] = await db
          .update(schema.plugins)
          .set({ status: 'active' as PluginStatus, updatedAt: new Date(), lastError: null })
          .where(eq(schema.plugins.slug, slug))
          .returning();

        if (!updated) {
          return NextResponse.json({ error: 'Plugin not installed' }, { status: 404 });
        }

        return NextResponse.json({ message: `${manifest.name} enabled`, plugin: updated });
      }

      // ─── DISABLE ──────────────────────────────────────────
      case 'disable': {
        const [updated] = await db
          .update(schema.plugins)
          .set({ status: 'disabled' as PluginStatus, updatedAt: new Date() })
          .where(eq(schema.plugins.slug, slug))
          .returning();

        if (!updated) {
          return NextResponse.json({ error: 'Plugin not installed' }, { status: 404 });
        }

        return NextResponse.json({ message: `${manifest.name} disabled`, plugin: updated });
      }

      // ─── UPDATE CONFIG ────────────────────────────────────
      case 'configure': {
        if (!config || typeof config !== 'object') {
          return NextResponse.json({ error: 'Config object is required' }, { status: 400 });
        }

        // Merge with existing config
        const [existing] = await db
          .select()
          .from(schema.plugins)
          .where(eq(schema.plugins.slug, slug))
          .limit(1);

        if (!existing) {
          return NextResponse.json({ error: 'Plugin not installed' }, { status: 404 });
        }

        const mergedConfig = { ...(existing.config as Record<string, unknown>), ...config };

        const [updated] = await db
          .update(schema.plugins)
          .set({ config: mergedConfig, updatedAt: new Date() })
          .where(eq(schema.plugins.slug, slug))
          .returning();

        return NextResponse.json({ message: `${manifest.name} configured`, plugin: updated });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: install, uninstall, enable, disable, configure` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('Plugin action error:', err);
    return NextResponse.json({ error: 'Plugin operation failed' }, { status: 500 });
  }
}
