import 'package:flutter/material.dart';
import '../../core/local_datetime.dart';
import '../../dashboard/data/dashboard_snapshot.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../widgets/callout.dart';
import '../../theme/tokens.dart';

/// The account hero's existing caption area, driven by the active quote.
class MetalPriceCaption extends StatelessWidget {
  const MetalPriceCaption({
    super.key,
    required this.quote,
    required this.metalType,
    required this.available,
  });
  final MetalSpotQuote? quote;
  final String? metalType;
  final bool available;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final stale = available && quote?.isStale == true;
    final time = stale
        ? formatLocalDateTime(quote!.effectiveAt.toIso8601String())
        : null;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            !available
                ? copy.liveMetalPriceUnavailable
                : stale
                ? copy.staleMetalPrice
                : copy.liveMetalPriceCaption(metalType),
            style: TextStyle(
              color: stale ? c.warningFg : c.inkMuted,
              fontSize: 12,
            ),
          ),
          if (time != null)
            Text(
              '${time.date} ${time.time}',
              textDirection: TextDirection.ltr,
              style: TextStyle(color: c.inkMuted, fontSize: 12),
            ),
        ],
      ),
    );
  }
}

class MetalPriceFreshness extends StatelessWidget {
  const MetalPriceFreshness({super.key, required this.quote});
  final MetalSpotQuote? quote;
  @override
  Widget build(BuildContext context) {
    if (quote?.isStale != true) return const SizedBox.shrink();
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final time = formatLocalDateTime(quote!.effectiveAt.toIso8601String());
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Callout(
        tone: CalloutTone.warning,
        message: '${copy.staleMetalPrice} · ${time.date} ${time.time}',
      ),
    );
  }
}
