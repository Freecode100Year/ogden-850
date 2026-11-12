package net.freedom8964.ogden850;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/**
 * The whole app is index.html in a WebView, served from the APK's assets at
 * https://appassets.androidplatform.net/assets/ so it works with no network.
 * Pronunciation: bundled recordings (assets/audio/uk|us/*.ogg), then the phone's
 * own text-to-speech through window.AndroidTTS (Android's WebView has no
 * speechSynthesis), then the website's online voices as a last resort.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";

    private WebView web;
    private WebViewAssetLoader assets;
    private TextToSpeech tts;
    private volatile boolean ttsReady;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // Debug builds only: lets the page be inspected from a computer (chrome://inspect).
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        web = new WebView(this);
        setContentView(web);
        fitSystemBars(web);

        assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // favourites, theme and accent are kept in localStorage
        s.setMediaPlaybackRequiresUserGesture(false); // a fallback recording may start after a short delay
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.addJavascriptInterface(new Speech(), "AndroidTTS");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                // index.html asks Google Fonts for its Latin fonts; serve the bundled copies.
                if (host.equals("fonts.googleapis.com")) return asset("fonts/fonts.css", "text/css");
                if (host.equals("fonts.gstatic.com")) {
                    String name = u.getLastPathSegment();
                    if (name != null && name.matches("[A-Za-z0-9_-]+\\.woff2")) return asset("fonts/files/" + name, "font/woff2");
                    return null;
                }
                return assets.shouldInterceptRequest(u);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u)); // other links open in the browser
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        tts = new TextToSpeech(this, status -> ttsReady = status == TextToSpeech.SUCCESS);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { finished(); }
            @Override public void onError(String id) { finished(); }
            @Override public void onStop(String id, boolean interrupted) { }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            // Android 13+ (and always from Android 16) delivers Back here instead of onBackPressed().
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    () -> { if (web.canGoBack()) web.goBack(); else finish(); });
        }

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    private WebResourceResponse asset(String path, String mime) {
        try {
            InputStream in = getAssets().open(path);
            return new WebResourceResponse(mime, null, in);
        } catch (IOException e) {
            return null;
        }
    }

    private void finished() {
        runOnUiThread(() -> web.evaluateJavascript("window.__ogdenTtsDone && window.__ogdenTtsDone()", null));
    }

    /** The phone's own voice, used for anything that is not in the bundled recordings. */
    private class Speech {
        @JavascriptInterface
        public boolean speak(String text, String lang, double rate) {
            if (!ttsReady || text == null || text.isEmpty()) return false;
            int r = tts.setLanguage(Locale.forLanguageTag(lang));
            if (r < TextToSpeech.LANG_AVAILABLE && tts.setLanguage(Locale.ENGLISH) < TextToSpeech.LANG_AVAILABLE) {
                return false; // no English voice on this phone
            }
            tts.setSpeechRate((float) Math.max(0.5, Math.min(2.0, rate)));
            return tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ogden") == TextToSpeech.SUCCESS;
        }

        @JavascriptInterface
        public void stop() {
            if (ttsReady) tts.stop();
        }
    }

    /** Keep the page clear of the status and navigation bars (edge-to-edge on Android 15+). */
    private static void fitSystemBars(View v) {
        v.setOnApplyWindowInsetsListener((view, in) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets b = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(b.left, b.top, b.right, b.bottom);
            } else {
                view.setPadding(in.getSystemWindowInsetLeft(), in.getSystemWindowInsetTop(),
                        in.getSystemWindowInsetRight(), in.getSystemWindowInsetBottom());
            }
            return in;
        });
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (ttsReady) tts.stop();
        web.evaluateJavascript("window.stopSpeaking && stopSpeaking()", null);
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }
}
