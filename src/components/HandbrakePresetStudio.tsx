import React, { useState } from 'react';
import { PipelineSettings } from '../types';
import {
  Sliders,
  Download,
  Copy,
  Check,
  Film,
  Volume2,
  Subtitles,
  HelpCircle,
  Code2,
  Sparkles,
} from 'lucide-react';

interface HandbrakePresetStudioProps {
  settings: PipelineSettings;
  setSettings: React.Dispatch<React.SetStateAction<PipelineSettings>>;
}

export const HandbrakePresetStudio: React.FC<HandbrakePresetStudioProps> = ({
  settings,
  setSettings,
}) => {
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Generate HandBrake CLI command for a sample file
  const generateCliCommand = () => {
    const encoder = settings.videoCodec === 'x265_10bit' ? 'x265_10bit' : 'x264';
    const decombFlag =
      settings.decombFilter === 'decomb'
        ? '--comb-detect --decomb'
        : settings.decombFilter === 'yadif'
        ? '--deinterlace=yadif'
        : '';

    const audioFlags = settings.addAacStereoFallback
      ? '-a 1,1 -E copy:ac3,av_aac -B 0,160 -6 0,dpl2 -R auto,auto'
      : '-a 1 -E copy:ac3';

    const subFlags =
      settings.subtitleMode === 'embed_vobsub'
        ? '-s "1,2" --subtitle-burned=none'
        : settings.subtitleMode === 'burn_in'
        ? '-s 1 --subtitle-burned'
        : '';

    return [
      `"${settings.handbrakeCliPath}"`,
      `-i "title_t00.mkv"`,
      `-o "NCIS (2003) - S01E01 - Yankee White.mkv"`,
      `-e ${encoder}`,
      `-q ${settings.rfQuality}`,
      `--pfr`, // Peak framerate
      `--rate 29.97`,
      `--auto-anamorphic`,
      decombFlag,
      audioFlags,
      subFlags,
      `--markers`, // Preserve chapter markers
      `--optimize`, // Web optimized (mp4/mkv fast start)
    ]
      .filter(Boolean)
      .join(' ');
  };

  // Generate official HandBrake preset JSON schema (compatible with HandBrake 1.6 - 1.8+)
  const generateHandBrakePresetJson = () => {
    const isX265 = settings.videoCodec === 'x265_10bit';
    const preset = {
      PresetList: [
        {
          AlignAVStart: true,
          AudioCopyMask: ['copy:aac', 'copy:ac3', 'copy:dtshd', 'copy:dts', 'copy:eac3', 'copy:flac', 'copy:mp3', 'copy:truehd'],
          AudioEncoderFallback: 'av_aac',
          AudioLanguageList: ['eng'],
          AudioList: [
            {
              AudioBitrate: 640,
              AudioCompressionLevel: 0,
              AudioDitherMethod: 'auto',
              AudioEncoder: 'copy:ac3',
              AudioMixdown: '5.1',
              AudioNormalizeMixLevel: false,
              AudioSamplerate: 'auto',
              AudioTrackDRCSlider: 0,
              AudioTrackGainSlider: 0,
              AudioTrackQuality: -1,
              AudioTrackQualityEnable: false,
              AudioTrackSelectionBehavior: 'first',
            },
            ...(settings.addAacStereoFallback
              ? [
                  {
                    AudioBitrate: 160,
                    AudioCompressionLevel: 0,
                    AudioDitherMethod: 'auto',
                    AudioEncoder: 'av_aac',
                    AudioMixdown: 'dpl2',
                    AudioNormalizeMixLevel: false,
                    AudioSamplerate: 'auto',
                    AudioTrackDRCSlider: 0,
                    AudioTrackGainSlider: 0,
                    AudioTrackQuality: -1,
                    AudioTrackQualityEnable: false,
                    AudioTrackSelectionBehavior: 'first',
                  },
                ]
              : []),
          ],
          ChapterMarkers: true,
          ChildrenArray: [],
          Default: false,
          FileFormat: 'av_mkv',
          Folder: false,
          Mp4HttpOptimize: false,
          PictureAutoCrop: true,
          PictureBottomCrop: 0,
          PictureDARWidth: 853,
          PictureDeblockCustom: 'strength=strong:thresh=20:block=8',
          PictureDeblockEnable: false,
          PictureDeinterlaceCustom: '',
          PictureDeinterlaceFilter: settings.decombFilter === 'decomb' ? 'decomb' : 'deinterlace',
          PictureDeinterlacePreset: 'default',
          PictureDetelecine: 'default',
          PictureDetelecineCustom: '',
          PictureForceHeight: 0,
          PictureForceWidth: 0,
          PictureHeight: 480,
          PictureItuPAR: false,
          PictureKeepRatio: true,
          PictureLeftCrop: 0,
          PictureModulus: 2,
          PicturePAR: 'auto',
          PicturePARHeight: 1,
          PicturePARWidth: 1,
          PictureRightCrop: 0,
          PictureTopCrop: 0,
          PictureWidth: 720,
          PresetDescription:
            'Optimized for NCIS NTSC 480i DVD box sets. Features dynamic decomb to eliminate telecine combing, AC3 5.1 surround sound passthrough, and Plex Direct Play compliance.',
          PresetName: isX265 ? 'NCIS DVD HQ Decomb (H.265 HEVC)' : 'NCIS DVD HQ Decomb (H.264)',
          Type: 1,
          UsesPictureFilters: true,
          UsesPictureSettings: 1,
          VideoAvgBitrate: 0,
          VideoColorMatrixCode: 0,
          VideoEncoder: isX265 ? 'x265_10bit' : 'x264',
          VideoFramerate: '29.97',
          VideoFramerateMode: 'pfr',
          VideoLevel: 'auto',
          VideoOptionExtra: '',
          VideoPreset: 'slow',
          VideoProfile: 'auto',
          VideoQualitySlider: settings.rfQuality,
          VideoQualityType: 2,
          VideoTune: 'film',
          VideoTurboTwoPass: false,
          VideoTwoPass: false,
        },
      ],
      VersionMajor: 52,
      VersionMicro: 0,
      VersionMinor: 0,
    };

    return JSON.stringify(preset, null, 2);
  };

  const copyCliString = () => {
    navigator.clipboard.writeText(generateCliCommand());
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const copyJsonPreset = () => {
    navigator.clipboard.writeText(generateHandBrakePresetJson());
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const downloadPresetFile = () => {
    const jsonStr = generateHandBrakePresetJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      settings.videoCodec === 'x265_10bit'
        ? 'NCIS_DVD_Decomb_H265.json'
        : 'NCIS_DVD_Decomb_H264.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Intro & DVD Deinterlacing Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              HandBrake DVD Deinterlacing & Encoding Studio
            </h3>
            <p className="text-xs text-slate-400">
              Configured specifically for NTSC 480i DVD box sets to prevent combing artifacts and optimize Plex Direct Play.
            </p>
          </div>
        </div>

        {/* Technical Callout */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Why Decomb is Critical for NCIS DVDs:</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Standard DVDs from the 2000s are mastered in 480i NTSC interlaced video. If encoded without proper filters, fast motion (Gibbs chasing suspects, muzzle flashes, rapid camera pans) results in jagged horizontal "combing" lines across the screen. The{' '}
            <strong className="text-slate-200">Decomb filter</strong> automatically detects interlacing on a frame-by-frame basis, deinterlacing only combed frames while preserving 100% of progressive film frames.
          </p>
        </div>
      </div>

      {/* Preset Customization Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Video Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Film className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Video & Deinterlacing Configuration
            </h4>
          </div>

          {/* Video Codec */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Video Codec
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSettings({ ...settings, videoCodec: 'x264', rfQuality: 19 })}
                className={`py-2 px-3 rounded-lg border text-left transition-all ${
                  settings.videoCodec === 'x264'
                    ? 'bg-amber-500/10 border-amber-500 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold">H.264 (x264)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Universal Direct Play on 100% of Plex clients.
                </div>
              </button>

              <button
                onClick={() => setSettings({ ...settings, videoCodec: 'x265_10bit', rfQuality: 21 })}
                className={`py-2 px-3 rounded-lg border text-left transition-all ${
                  settings.videoCodec === 'x265_10bit'
                    ? 'bg-amber-500/10 border-amber-500 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold">H.265 / HEVC 10-bit</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ~40% smaller file size (~400MB vs ~750MB/ep).
                </div>
              </button>
            </div>
          </div>

          {/* Deinterlace Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Deinterlace & Telecine Filter
            </label>
            <div className="space-y-1.5">
              {[
                {
                  id: 'decomb',
                  label: 'Decomb (Comb Detect + Decomb)',
                  desc: 'Recommended: Detects interlaced frames and deinterlaces only when needed.',
                },
                {
                  id: 'yadif',
                  label: 'Yadif (Deinterlace All Frames)',
                  desc: 'Applies full Yadif deinterlacing to every frame.',
                },
                {
                  id: 'off',
                  label: 'Off (Keep Raw Interlacing)',
                  desc: 'Not recommended for modern LED/OLED displays.',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                    settings.decombFilter === opt.id
                      ? 'bg-amber-500/5 border-amber-500/40 text-slate-200'
                      : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="decombFilter"
                    checked={settings.decombFilter === opt.id}
                    onChange={() =>
                      setSettings({
                        ...settings,
                        decombFilter: opt.id as 'decomb' | 'yadif' | 'off',
                      })
                    }
                    className="mt-0.5 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-medium text-white block">{opt.label}</span>
                    <span className="text-[11px] text-slate-400">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quality Slider (RF) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Constant Rate Factor (RF): <span className="text-amber-400 font-mono">{settings.rfQuality}</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {settings.rfQuality <= 19
                  ? 'Near Lossless DVD Quality'
                  : settings.rfQuality <= 22
                  ? 'Balanced Size & High Fidelity'
                  : 'Maximum Compression'}
              </span>
            </div>
            <input
              type="range"
              min={16}
              max={26}
              value={settings.rfQuality}
              onChange={(e) => setSettings({ ...settings, rfQuality: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>RF 16 (High Bitrate / ~1.2 GB)</span>
              <span>RF 20 (Optimal / ~650 MB)</span>
              <span>RF 26 (Small / ~350 MB)</span>
            </div>
          </div>
        </div>

        {/* Audio & Subtitle Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Audio & Subtitles Configuration
            </h4>
          </div>

          {/* Audio Tracks */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Audio Tracks & Passthrough
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.keepOriginalAudioTrack}
                onChange={(e) =>
                  setSettings({ ...settings, keepOriginalAudioTrack: e.target.checked })
                }
                className="mt-0.5 text-amber-500 rounded focus:ring-amber-500"
              />
              <div>
                <span className="text-xs font-medium text-white block">
                  Preserve Original Dolby Digital 5.1 AC3 Audio
                </span>
                <span className="text-[11px] text-slate-400">
                  Lossless passthrough of the DVD surround sound soundtrack without recompression.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.addAacStereoFallback}
                onChange={(e) =>
                  setSettings({ ...settings, addAacStereoFallback: e.target.checked })
                }
                className="mt-0.5 text-amber-500 rounded focus:ring-amber-500"
              />
              <div>
                <span className="text-xs font-medium text-white block">
                  Add Secondary AAC Stereo Downmix (Plex Mobile Direct Play)
                </span>
                <span className="text-[11px] text-slate-400">
                  Ensures smooth playback on mobile phones, iPads, and web browsers that lack 5.1 surround decoders.
                </span>
              </div>
            </label>
          </div>

          {/* Subtitles */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <Subtitles className="w-4 h-4 text-amber-400" />
              <label className="text-xs font-semibold text-slate-300">
                English Subtitles
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSettings({ ...settings, subtitleMode: 'embed_vobsub' })}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  settings.subtitleMode === 'embed_vobsub'
                    ? 'bg-amber-500/10 border-amber-500 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold">Embed VOBSUB Track</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Selectable in Plex player menu.
                </div>
              </button>

              <button
                onClick={() => setSettings({ ...settings, subtitleMode: 'none' })}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  settings.subtitleMode === 'none'
                    ? 'bg-amber-500/10 border-amber-500 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold">No Subtitles</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Fastest transcode speed.
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Exporter Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-400" />
              Official HandBrake GUI Preset Export (.json)
            </h4>
            <p className="text-xs text-slate-400">
              Import directly into HandBrake Desktop GUI via: <span className="font-mono text-amber-300">Presets → Options → Import from file...</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyJsonPreset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied JSON!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Preset JSON</span>
                </>
              )}
            </button>

            <button
              onClick={downloadPresetFile}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .json Preset</span>
            </button>
          </div>
        </div>

        {/* Live CLI String Preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-400 font-mono">
              Live HandBrakeCLI Command Template:
            </span>
            <button
              onClick={copyCliString}
              className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              {copiedCli ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedCli ? 'Copied CLI Command' : 'Copy Command'}
            </button>
          </div>
          <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-amber-200/90 overflow-x-auto whitespace-pre-wrap break-all">
            {generateCliCommand()}
          </pre>
        </div>
      </div>
    </div>
  );
};
