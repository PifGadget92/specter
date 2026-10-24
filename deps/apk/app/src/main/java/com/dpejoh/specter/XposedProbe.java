package com.dpejoh.specter;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Looper;
import android.system.Os;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Prints installed apps that declare Xposed module metadata.
 *
 * Output is one tab-separated line per app: package name, matched metadata
 * keys. Runs through app_process; it does not stay resident.
 */
public class XposedProbe {
    private static final String[] XPOSED_KEYS = {
        "xposedmodule",
        "xposedminversion",
        "xposeddescription",
        "xposedscope",
        "xposedsharedprefs",
    };

    public static void main(String[] args) {
        try {
            if (Os.geteuid() == 0) {
                try { Os.seteuid(1000); } catch (Throwable ignored) {}
            }
            if (Looper.getMainLooper() == null) {
                Looper.prepareMainLooper();
            }

            Class<?> activityThreadClass = Class.forName("android.app.ActivityThread");
            Object activityThread = activityThreadClass.getMethod("systemMain").invoke(null);
            Context context = (Context) activityThreadClass
                .getMethod("getSystemContext")
                .invoke(activityThread);

            PackageManager pm = context.getPackageManager();
            List<ApplicationInfo> apps = pm.getInstalledApplications(PackageManager.GET_META_DATA);

            List<String> lines = new ArrayList<>();
            for (ApplicationInfo app : apps) {
                Bundle metadata = app.metaData;
                if (metadata == null) {
                    continue;
                }

                StringBuilder keys = new StringBuilder();
                for (String key : XPOSED_KEYS) {
                    if (!metadata.containsKey(key)) {
                        continue;
                    }
                    if (keys.length() > 0) {
                        keys.append(',');
                    }
                    keys.append(key);
                }

                if (keys.length() > 0) {
                    lines.add(app.packageName + "\t" + keys);
                }
            }

            Collections.sort(lines);
            for (String line : lines) {
                System.out.println(line);
            }
        } catch (Throwable t) {
            t.printStackTrace();
            System.exit(2);
        }
        System.exit(0);
    }
}
