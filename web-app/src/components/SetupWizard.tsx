import { useState } from 'react';
import * as api from '../services/api';
import type { HueBridge } from '../types/devices';

interface SetupWizardProps {
  onComplete: () => void;
  hueConfigured: boolean;
  nanoleafConfigured: boolean;
}

type Step = 'welcome' | 'hue-discover' | 'hue-connect' | 'nanoleaf-connect' | 'complete';

export function SetupWizard({ onComplete, hueConfigured, nanoleafConfigured }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [bridges, setBridges] = useState<HueBridge[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<string>('');
  const [nanoleafIp, setNanoleafIp] = useState('');
  const [nanoleafName, setNanoleafName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discoverHueBridges = async () => {
    setLoading(true);
    setError(null);
    try {
      const discovered = await api.discoverHueBridges();
      setBridges(discovered);
      if (discovered.length === 1) {
        setSelectedBridge(discovered[0].internalipaddress);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const connectHue = async () => {
    if (!selectedBridge) return;
    
    setLoading(true);
    setError(null);
    try {
      await api.authenticateHue(selectedBridge);
      setStep('complete');
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('link button')) {
        setError('Please press the link button on your Hue bridge, then try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const connectNanoleaf = async () => {
    if (!nanoleafIp) return;
    
    setLoading(true);
    setError(null);
    try {
      await api.authenticateNanoleaf(nanoleafIp, nanoleafName || undefined);
      setNanoleafIp('');
      setNanoleafName('');
      setError(null);
      // Ask if they want to add another
      const addAnother = window.confirm('Device added successfully! Do you want to add another Nanoleaf device?');
      if (!addAnother) {
        setStep('complete');
      }
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('pairing mode')) {
        setError('Please put your Nanoleaf device in pairing mode (hold power button for 5-7 seconds or use the Nanoleaf app), then try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <div className="text-center">
            <div className="text-6xl mb-6">🏠</div>
            <h2 className="text-2xl font-bold mb-4">Welcome to Smart Home</h2>
            <p className="text-zinc-400 mb-8">
              Let's set up your smart devices. You can control Philips Hue and WiFi-enabled Nanoleaf devices from this app.
            </p>
            <div className="space-y-3">
              {!hueConfigured && (
                <button
                  onClick={() => {
                    setStep('hue-discover');
                    discoverHueBridges();
                  }}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 rounded-xl font-medium transition-colors"
                >
                  Set up Philips Hue
                </button>
              )}
              <button
                onClick={() => setStep('nanoleaf-connect')}
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-medium transition-colors"
              >
                {nanoleafConfigured ? 'Add Another Nanoleaf (WiFi)' : 'Set up Nanoleaf (WiFi only)'}
              </button>
              <button
                onClick={onComplete}
                className="w-full py-3 px-4 bg-zinc-700 hover:bg-zinc-600 rounded-xl font-medium transition-colors"
              >
                {hueConfigured || nanoleafConfigured ? 'Done' : 'Skip Setup'}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Note: Bluetooth-only Nanoleaf devices are not supported (API requires WiFi).
            </p>
          </div>
        );

      case 'hue-discover':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Connect Philips Hue</h2>
            <p className="text-zinc-400 mb-6">
              {loading
                ? 'Searching for Hue bridges on your network...'
                : bridges.length > 0
                ? 'Select your Hue bridge:'
                : 'No Hue bridges found on your network.'}
            </p>

            {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
              </div>
            )}

            {!loading && bridges.length > 0 && (
              <div className="space-y-2 mb-6">
                {bridges.map((bridge) => (
                  <button
                    key={bridge.id}
                    onClick={() => setSelectedBridge(bridge.internalipaddress)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      selectedBridge === bridge.internalipaddress
                        ? 'bg-amber-500/20 border-amber-500 border'
                        : 'bg-zinc-800 border-zinc-700 border hover:bg-zinc-700'
                    }`}
                  >
                    <div className="font-medium">Hue Bridge</div>
                    <div className="text-sm text-zinc-400">{bridge.internalipaddress}</div>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 py-3 px-4 bg-zinc-700 hover:bg-zinc-600 rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              {bridges.length > 0 && (
                <button
                  onClick={() => setStep('hue-connect')}
                  disabled={!selectedBridge}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 rounded-xl font-medium transition-colors"
                >
                  Next
                </button>
              )}
              {bridges.length === 0 && !loading && (
                <button
                  onClick={discoverHueBridges}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 rounded-xl font-medium transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        );

      case 'hue-connect':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Press the Link Button</h2>
            <p className="text-zinc-400 mb-6">
              Press the large button on top of your Hue bridge, then click Connect below.
            </p>

            <div className="flex justify-center py-8">
              <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center">
                <div className="w-16 h-16 bg-zinc-700 rounded-full animate-pulse" />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('hue-discover')}
                className="flex-1 py-3 px-4 bg-zinc-700 hover:bg-zinc-600 rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={connectHue}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        );

      case 'nanoleaf-connect':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Connect Nanoleaf (WiFi)</h2>
            <p className="text-zinc-400 mb-6">
              Enter your Nanoleaf device's IP address. You can find this in your router's DHCP settings or the Nanoleaf app.
            </p>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
              <p className="text-sm text-amber-200">
                <strong>Note:</strong> Only WiFi-enabled Nanoleaf devices are supported. Bluetooth-only devices cannot be controlled via this API.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Device IP Address</label>
                <input
                  type="text"
                  value={nanoleafIp}
                  onChange={(e) => setNanoleafIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Device Name (optional)</label>
                <input
                  type="text"
                  value={nanoleafName}
                  onChange={(e) => setNanoleafName(e.target.value)}
                  placeholder="Living Room Nanoleaf"
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-green-500"
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-800 rounded-xl mb-6">
              <p className="text-sm text-zinc-400">
                <strong className="text-white">Before connecting:</strong> Put your Nanoleaf device in pairing mode by holding the power button for 5-7 seconds (until the lights flash), or use the "Connect to API" button in the Nanoleaf app settings.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 py-3 px-4 bg-zinc-700 hover:bg-zinc-600 rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('complete')}
                className="flex-1 py-3 px-4 bg-zinc-600 hover:bg-zinc-500 rounded-xl font-medium transition-colors"
              >
                Skip
              </button>
              <button
                onClick={connectNanoleaf}
                disabled={loading || !nanoleafIp}
                className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            <div className="text-6xl mb-6">✨</div>
            <h2 className="text-2xl font-bold mb-4">You're All Set!</h2>
            <p className="text-zinc-400 mb-8">
              Your devices are configured and ready to use. You can always add more devices later from the settings.
            </p>
            <button
              onClick={onComplete}
              className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 rounded-xl font-medium transition-colors"
            >
              Start Using Smart Home
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-zinc-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 sm:p-8 overflow-y-auto">
        {renderStep()}
      </div>
    </div>
  );
}
