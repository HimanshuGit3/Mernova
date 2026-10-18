import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/session.dart';
import '../services/biometric_service.dart';
import '../services/offline_queue.dart';
import '../theme/tokens.dart';

/// Tracks whether the phone has any network (Wi-Fi or mobile data).
class ConnectivityStatus extends ChangeNotifier {
  ConnectivityStatus([Connectivity? connectivity]) : _connectivity = connectivity ?? Connectivity() {
    _sub = _connectivity.onConnectivityChanged.listen(_update);
    _connectivity.checkConnectivity().then(_update).ignore();
  }

  final Connectivity _connectivity;
  late final StreamSubscription<List<ConnectivityResult>> _sub;
  bool online = true;

  /// Fires each time the phone comes back online.
  final _back = StreamController<void>.broadcast();
  Stream<void> get backOnline => _back.stream;

  void _update(List<ConnectivityResult> results) {
    final now = results.any((r) => r != ConnectivityResult.none);
    if (now == online) return;
    online = now;
    if (now) _back.add(null);
    notifyListeners();
  }

  @override
  void dispose() {
    _sub.cancel();
    _back.close();
    super.dispose();
  }
}

/// "You're offline" / "2 reports waiting to send" strip shown above the main screens (SPEC 8.3).
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final online = context.watch<ConnectivityStatus>().online;
    final pending = context.watch<OfflineQueue>().pendingFor(context.watch<Session>().user?.id);
    if (online && pending == 0) return const SizedBox.shrink();
    final text = !online
        ? (pending > 0 ? "You're offline · $pending ${pending == 1 ? 'report' : 'reports'} waiting to send" : "You're offline · reports will be saved and sent later")
        : 'Sending $pending waiting ${pending == 1 ? 'report' : 'reports'}…';
    return Semantics(
      liveRegion: true,
      child: Material(
        color: online ? StatusColors.open : Brand.navy700,
        child: InkWell(
          onTap: online ? () => context.read<OfflineQueue>().flush(force: true, ownerId: context.read<Session>().user?.id) : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Icon(online ? Icons.cloud_upload_outlined : Icons.cloud_off_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
                if (pending > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: Brand.gold300, borderRadius: BorderRadius.circular(99)),
                    child: Text('$pending', style: const TextStyle(color: Brand.navy900, fontWeight: FontWeight.w800)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Profile rows added in phase 10: biometric unlock and the offline queue.
class DeviceSettings extends StatelessWidget {
  const DeviceSettings({super.key});

  @override
  Widget build(BuildContext context) {
    final bio = context.watch<BiometricService>();
    final queue = context.watch<OfflineQueue>();
    final mine = queue.itemsFor(context.watch<Session>().user?.id);
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        Text('Security', style: text.titleMedium),
        const SizedBox(height: 4),
        FutureBuilder<bool>(
          future: bio.available(),
          builder: (context, snap) {
            final available = snap.data ?? false;
            return SwitchListTile(
              contentPadding: EdgeInsets.zero,
              secondary: const Icon(Icons.fingerprint_rounded),
              title: const Text('Biometric unlock'),
              subtitle: Text(available ? 'Ask for fingerprint or face when opening the app' : 'Not available on this device'),
              value: bio.enabled,
              onChanged: available
                  ? (v) async {
                      final messenger = ScaffoldMessenger.of(context);
                      final ok = await bio.setEnabled(v);
                      if (!ok) messenger.showSnackBar(const SnackBar(content: Text('Biometric check failed; setting unchanged')));
                    }
                  : null,
            );
          },
        ),
        if (mine.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('Waiting to send', style: text.titleMedium),
          for (final q in mine)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.schedule_send_rounded),
              title: Text(q.report.title),
              subtitle: Text(q.attempts == 0 ? 'Will send when online' : 'Tried ${q.attempts}× · retrying automatically'),
            ),
          TextButton.icon(
            onPressed: () => queue.flush(force: true, ownerId: context.read<Session>().user?.id),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try sending now'),
          ),
        ],
      ],
    );
  }
}
