/**
 * Session Manager — Manages multiple WhatsApp instances
 * Handles creating, destroying, listing, and restoring instances on startup.
 */

const { v4: uuidv4 } = require('uuid');
const WhatsAppService = require('./whatsappService');
const Instance = require('../models/Instance');
const fs = require('fs');
const path = require('path');
const { getSessionPath } = require('../config/whatsapp');

class SessionManager {
  constructor(io) {
    this.io = io;
    // Map of instanceId -> WhatsAppService
    this.instances = new Map();
  }

  /**
   * Create a new WhatsApp instance
   */
  async createInstance(name, userId) {
    const instanceId = `inst_${uuidv4().split('-')[0]}`;

    // Check rate limit (10 per hour per user)
    const recentCount = Instance.countRecentByUser(userId);
    if (recentCount >= 10) {
      throw new Error('Instance creation limit reached. Max 10 per hour.');
    }

    // Create DB record
    Instance.create(instanceId, name, userId);
    console.log(`🆕 Created instance: ${instanceId} (${name})`);

    // Create and initialize WhatsApp service
    const service = new WhatsAppService(instanceId, this.io);
    this.instances.set(instanceId, service);

    // Initialize in background (QR will be emitted via Socket.io)
    service.initialize().catch(err => {
      console.error(`❌ Failed to initialize instance ${instanceId}:`, err);
      Instance.updateStatus(instanceId, 'error');
    });

    return {
      instanceId,
      name,
      status: 'initializing'
    };
  }

  /**
   * Get a specific WhatsApp service instance
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId);
  }

  /**
   * Get status of an instance
   */
  getInstanceStatus(instanceId) {
    const service = this.instances.get(instanceId);
    if (service) {
      return service.getStatus();
    }

    // Check DB for instances that aren't running
    const dbInstance = Instance.findById(instanceId);
    if (dbInstance) {
      return {
        instanceId,
        status: dbInstance.status,
        phone: dbInstance.phone,
        isReady: false
      };
    }

    return null;
  }

  /**
   * Get QR code for an instance
   */
  getQrCode(instanceId) {
    const instance = Instance.findById(instanceId);
    if (!instance) return null;
    return instance.qr_code;
  }

  /**
   * Destroy and remove an instance
   */
  async deleteInstance(instanceId) {
    const service = this.instances.get(instanceId);

    if (service) {
      await service.destroy();
      this.instances.delete(instanceId);
    }

    // Clean up session files
    const sessionPath = getSessionPath(instanceId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🗑️ Cleaned session files for ${instanceId}`);
    }

    // Delete from DB
    Instance.delete(instanceId);
    console.log(`🗑️ Deleted instance: ${instanceId}`);
  }

  /**
   * List all instances
   */
  listInstances(userId = null) {
    if (userId) {
      return Instance.findByUserId(userId);
    }
    return Instance.findAll();
  }

  /**
   * Restore all active instances on server startup
   * Tries to re-initialize instances that were previously connected.
   */
  async restoreInstances() {
    const activeInstances = Instance.findActive();

    if (activeInstances.length === 0) {
      console.log('ℹ️ No active instances to restore');
      return;
    }

    console.log(`🔄 Restoring ${activeInstances.length} instance(s)...`);

    for (const inst of activeInstances) {
      try {
        const service = new WhatsAppService(inst.id, this.io);
        this.instances.set(inst.id, service);

        // Initialize in background
        service.initialize().catch(err => {
          console.error(`❌ Failed to restore instance ${inst.id}:`, err.message);
          Instance.updateStatus(inst.id, 'error');
        });

        console.log(`  ↳ Restoring ${inst.id} (${inst.name})`);
      } catch (err) {
        console.error(`❌ Error restoring instance ${inst.id}:`, err.message);
      }
    }
  }

  /**
   * Graceful shutdown — destroy all instances and save state
   */
  async shutdown() {
    console.log('🔄 Shutting down all WhatsApp instances...');

    const promises = [];
    for (const [id, service] of this.instances) {
      promises.push(
        service.destroy().catch(err => {
          console.error(`⚠️ Error destroying ${id}:`, err.message);
        })
      );
    }

    await Promise.all(promises);
    this.instances.clear();
    console.log('✅ All instances shut down');
  }

  /**
   * Get count of active instances
   */
  getActiveCount() {
    return this.instances.size;
  }
}

module.exports = SessionManager;
