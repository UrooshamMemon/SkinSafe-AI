import React, { useState } from "react";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  useFonts,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
  CormorantGaramond_500Medium_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Jost_400Regular,
  Jost_500Medium,
  Jost_600SemiBold,
} from "@expo-google-fonts/jost";

const API_URL = "http://192.168.18.162:8000";
const C = {
  blue: "#59C4D9",
  blueDark: "#2A8FA6",
  blueDeep: "#1F6478",
  blueSoft: "#E6F6FA",
  blueLine: "#CBEAF2",
  pink: "#F0BBD1",
  pinkDark: "#C2557F",
  pinkSoft: "#FDF0F5",
  pinkLine: "#F7D9E5",
  white: "#FFFFFF",
  bg: "#F7FCFD",
  ink: "#1E3A44",
  inkSoft: "#5E7782",
  inkMute: "#93A8B0",
  // functional colors
  good: "#2E9E83",
  goodSoft: "#E4F6F0",
  warn: "#D9822B",
  warnSoft: "#FFF3E3",
  danger: "#D0526A",
  dangerSoft: "#FDE9ED",
};

const F = {
  serif: "CormorantGaramond_600SemiBold",
  serifBold: "CormorantGaramond_700Bold",
  serifItalic: "CormorantGaramond_500Medium_Italic",
  sans: "Jost_400Regular",
  sansMed: "Jost_500Medium",
  sansBold: "Jost_600SemiBold",
};

function formatDetailValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .map((item) => String(item).trim())
    .filter(
      (item) =>
        item &&
        !["[]", "null", "none", "nan", "n/a", "unknown"].includes(
          item.toLowerCase()
        )
    )
    .join(", ");
}

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    CormorantGaramond_500Medium_Italic,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
  });

  const [ingredients, setIngredients] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState("");
  const [labelImage, setLabelImage] = useState(null);

  async function chooseLabelPhoto() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo library access to select an ingredient label."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setLabelImage(result.assets[0].uri);
        setError("");
      }
    } catch (err) {
      console.error("Photo picker error:", err);
      Alert.alert("Unable to open photos", "Please try again.");
    }
  }

  async function takeLabelPhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera access needed",
          "Allow camera access to photograph an ingredient label."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setLabelImage(result.assets[0].uri);
        setError("");
      }
    } catch (err) {
      console.error("Camera error:", err);
      Alert.alert("Unable to open camera", "Please try again.");
    }
  }

  async function extractTextFromPhoto() {
    if (!labelImage) {
      setError("Please choose or take a label photo first.");
      return;
    }

    setOcrLoading(true);
    setError("");

    try {
      const formData = new FormData();
      const imageFile = new File(labelImage);

      formData.append("file", imageFile);

      const response = await expoFetch(`${API_URL}/ocr`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not extract text from this photo."
        );
      }

      if (!data.text || !data.text.trim()) {
        setError(
          data.message || "No text detected. Try a clearer label photo."
        );
        return;
      }

      setIngredients(data.text);
      setResults(null);
      setError("");
      Alert.alert(
        "Text extracted",
        "Review the extracted text and correct any mistakes before analyzing."
      );
    } catch (err) {
      console.error("OCR error:", err);
      setError(
        err.message ||
          "Could not connect to the OCR service. Check your backend and internet connection."
      );
    } finally {
      setOcrLoading(false);
    }
  }

  async function analyzeIngredients() {
    if (!ingredients.trim()) {
      setError("Enter the ingredient list before analyzing.");
      setResults(null);
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const response = await fetch(`${API_URL}/analyze-ingredients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ingredients: ingredients.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(
        "Could not connect to SkinSafe AI. Check that your phone and laptop are on the same Wi-Fi and the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetAnalysis() {
    setIngredients("");
    setResults(null);
    setError("");
    setLabelImage(null);
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={C.blue} size="large" />
      </View>
    );
  }

  // Small helper for a labelled, color-coded detail block
  function DetailBlock({ label, text, tone }) {
    const tones = {
      blue: { bg: C.blueSoft, fg: C.blueDeep, dot: C.blue },
      good: { bg: C.goodSoft, fg: "#1F7360", dot: C.good },
      warn: { bg: C.warnSoft, fg: "#A85F13", dot: C.warn },
      pink: { bg: C.pinkSoft, fg: C.pinkDark, dot: C.pink },
    };
    const t = tones[tone] || tones.blue;
    return (
      <View style={[styles.detailBlock, { backgroundColor: t.bg }]}>
        <View style={styles.detailLabelRow}>
          <View style={[styles.detailDot, { backgroundColor: t.dot }]} />
          <Text style={[styles.detailLabel, { color: t.fg }]}>{label}</Text>
        </View>
        <Text style={styles.detailText}>{text}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Header / Logo ---------- */}
        <View style={styles.header}>
          <Image
            source={require("./assets/logo-full.png")}
            style={styles.logoFull}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>
            Understand your skincare ingredients.
          </Text>
        </View>

        {/* ---------- Hero ---------- */}
        <View style={styles.hero}>
          <View style={styles.heroBlob} />
          <View style={styles.heroBlobPink} />
          <Text style={styles.eyebrow}>YOUR SKINCARE, SIMPLIFIED</Text>
          <Text style={styles.heading}>
            Know what's{"\n"}
            <Text style={styles.headingItalic}>in your products.</Text>
          </Text>
          <Text style={styles.description}>
            Upload a product label or enter ingredients to explore their
            functions and potential concerns.
          </Text>
        </View>

        {/* ---------- Scan card ---------- */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={[styles.stepBadge, { backgroundColor: C.blueSoft }]}>
              <Text style={[styles.stepBadgeText, { color: C.blueDark }]}>
                1
              </Text>
            </View>
            <Text style={styles.sectionTitle}>SCAN A PRODUCT LABEL</Text>
          </View>
          <Text style={styles.helper}>
            Choose a label photo from your gallery or take a new picture.
          </Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={chooseLabelPhoto}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Choose Label Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cameraButton}
            onPress={takeLabelPhoto}
            activeOpacity={0.85}
          >
            <Text style={styles.cameraButtonText}>Take a Photo</Text>
          </TouchableOpacity>

          {labelImage && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: labelImage }}
                style={styles.labelImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                onPress={() => setLabelImage(null)}
                style={styles.removePhoto}
              >
                <Text style={styles.removePhotoText}>Remove photo</Text>
              </TouchableOpacity>
              <Text style={styles.photoNote}>
                Photo selected. Extract its ingredient text below.
              </Text>

              <TouchableOpacity
                style={[
                  styles.pinkButton,
                  ocrLoading && styles.disabledButton,
                ]}
                onPress={extractTextFromPhoto}
                disabled={ocrLoading || loading}
                activeOpacity={0.85}
              >
                {ocrLoading ? (
                  <ActivityIndicator color={C.pinkDark} />
                ) : (
                  <Text style={styles.pinkButtonText}>
                    Extract Ingredients from Photo
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.titleRow}>
            <View style={[styles.stepBadge, { backgroundColor: C.pinkSoft }]}>
              <Text style={[styles.stepBadgeText, { color: C.pinkDark }]}>
                2
              </Text>
            </View>
            <Text style={styles.sectionTitle}>ENTER INGREDIENTS</Text>
          </View>
          <Text style={styles.helper}>
            Separate ingredient names with commas.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. Aqua, Niacinamide, Glycerin"
            placeholderTextColor={C.inkMute}
            value={ingredients}
            onChangeText={setIngredients}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
          />

          <TouchableOpacity
            style={[styles.analyzeButton, loading && styles.disabledButton]}
            onPress={analyzeIngredients}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.analyzeButtonText}>Analyze Ingredients</Text>
            )}
          </TouchableOpacity>

          {!!error && (
            <View style={styles.errorBox}>
              <View style={styles.errorBar} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          {/* ---------- Results ---------- */}
          {results && (
            <View style={styles.results}>
              <Text style={styles.resultsTitle}>Analysis Results</Text>

              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.summaryItem,
                    { backgroundColor: C.blueSoft, borderColor: C.blueLine },
                  ]}
                >
                  <Text style={[styles.summaryNumber, { color: C.blueDark }]}>
                    {results.ingredient_count}
                  </Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>

                <View
                  style={[
                    styles.summaryItem,
                    { backgroundColor: C.goodSoft, borderColor: "#C6EADF" },
                  ]}
                >
                  <Text style={[styles.summaryNumber, { color: C.good }]}>
                    {results.identified_count}
                  </Text>
                  <Text style={styles.summaryLabel}>Identified</Text>
                </View>

                <View
                  style={[
                    styles.summaryItem,
                    { backgroundColor: C.pinkSoft, borderColor: C.pinkLine },
                  ]}
                >
                  <Text style={[styles.summaryNumber, { color: C.pinkDark }]}>
                    {results.unknown_count}
                  </Text>
                  <Text style={styles.summaryLabel}>Unknown</Text>
                </View>
              </View>

              {results.results?.map((item, index) => {
                const identified = item.status === "identified";

                return (
                  <View
                    key={`${item.input}-${index}`}
                    style={[
                      styles.resultItem,
                      {
                        borderLeftColor: identified ? C.good : C.pink,
                      },
                    ]}
                  >
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultName}>{item.input}</Text>
                      <Text
                        style={[
                          styles.resultBadge,
                          identified
                            ? styles.identifiedBadge
                            : styles.unknownBadge,
                        ]}
                      >
                        {identified ? "Identified" : "Unknown"}
                      </Text>
                    </View>

                    {Array.isArray(item.data) && item.data.length > 0 ? (
                      <>
                        {item.data[0].common_name &&
                          item.data[0].common_name !== item.input && (
                            <Text style={styles.resultDetail}>
                              Common name:{" "}
                              <Text style={styles.resultDetailStrong}>
                                {item.data[0].common_name}
                              </Text>
                            </Text>
                          )}

                        {item.data[0].category && (
                          <View style={styles.categoryRow}>
                            <Text style={styles.categoryLabel}>Category</Text>
                            <View style={styles.categoryChip}>
                              <Text style={styles.categoryChipText}>
                                {Array.isArray(item.data[0].category)
                                  ? item.data[0].category.join(", ")
                                  : item.data[0].category}
                              </Text>
                            </View>
                          </View>
                        )}

                        {item.data[0].description && (
                          <Text style={styles.resultDescription}>
                            {item.data[0].description}
                          </Text>
                        )}

                        {(() => {
                          const ingredient = item.data[0];

                          const functionText = [
                            formatDetailValue(ingredient.function1),
                            formatDetailValue(ingredient.function2),
                          ].filter(Boolean).join(", ");

                          const benefitsText = formatDetailValue(ingredient.benefits);
                          const concernsText = formatDetailValue(ingredient.concerns);
                          const skinTypesText = formatDetailValue(ingredient.skin_types);
                          const pregnancyText = formatDetailValue(ingredient.pregnancy_safe);
                          const pairsWellText = formatDetailValue(ingredient.pairs_well_with);

                          return (
                            <>
                              {functionText ? (
                                <DetailBlock label="Function" tone="blue" text={functionText} />
                              ) : null}

                              {benefitsText ? (
                                <DetailBlock label="Benefits" tone="good" text={benefitsText} />
                              ) : null}

                              {concernsText ? (
                                <DetailBlock
                                  label="Potential concerns"
                                  tone="warn"
                                  text={concernsText}
                                />
                              ) : null}

                              {skinTypesText ? (
                                <DetailBlock
                                  label="Suitable skin types"
                                  tone="blue"
                                  text={skinTypesText}
                                />
                              ) : null}

                              {pregnancyText ? (
                                <DetailBlock
                                  label="Pregnancy safety"
                                  tone="good"
                                  text={pregnancyText}
                                />
                              ) : null}

                              {pairsWellText ? (
                                <DetailBlock
                                  label="Pairs well with"
                                  tone="pink"
                                  text={pairsWellText}
                                />
                              ) : null}
                            </>
                          );
                        })()}

                      </>
                    ) : (
                      <Text style={styles.resultDetail}>
                        No ingredient details found for this ingredient.
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ---------- Note ---------- */}
        <View style={styles.noteCard}>
          <View style={styles.noteIcon}>
            <Text style={styles.noteIconText}>i</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.noteTitle}>Ingredient awareness</Text>
            <Text style={styles.noteText}>
              Learn about ingredient functions and potential concerns. Results
              depend on the available database and are not a medical diagnosis.
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={resetAnalysis} style={styles.resetButton}>
          <Text style={styles.resetText}>Clear and start again</Text>
        </TouchableOpacity>

        <View style={styles.footerWrap}>
          <Image
            source={require("./assets/logo-icon.png")}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <Text style={styles.footer}>SKINCARE KNOWLEDGE, MADE SIMPLE</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = {
  shadowColor: "#2A8FA6",
  shadowOpacity: 0.1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 26,
  },
  logoFull: {
    width: 170,
    height: 82,
  },
  tagline: {
    marginTop: 6,
    color: C.inkSoft,
    fontSize: 13,
    fontFamily: F.sans,
    letterSpacing: 0.4,
  },

  // Hero
  hero: {
    backgroundColor: C.white,
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.blueLine,
    ...shadow,
  },
  heroBlob: {
    position: "absolute",
    top: -50,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.blueSoft,
  },
  heroBlobPink: {
    position: "absolute",
    bottom: -40,
    right: 30,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.pinkSoft,
  },
  eyebrow: {
    color: C.pinkDark,
    fontSize: 11,
    fontFamily: F.sansBold,
    letterSpacing: 2,
    marginBottom: 12,
  },
  heading: {
    color: C.ink,
    fontSize: 40,
    lineHeight: 44,
    fontFamily: F.serifBold,
  },
  headingItalic: {
    color: C.blueDark,
    fontFamily: F.serifItalic,
    fontStyle: "italic",
  },
  description: {
    marginTop: 14,
    color: C.inkSoft,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: F.sans,
  },

  // Main card
  card: {
    backgroundColor: C.white,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: C.blueLine,
    ...shadow,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    fontSize: 13,
    fontFamily: F.sansBold,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 12,
    fontFamily: F.sansBold,
    letterSpacing: 1.6,
  },
  helper: {
    color: C.inkSoft,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 14,
    fontFamily: F.sans,
  },
  secondaryButton: {
    backgroundColor: C.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.blue,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  secondaryButtonText: {
    color: C.white,
    fontSize: 14,
    fontFamily: F.sansBold,
    letterSpacing: 0.5,
  },
  cameraButton: {
    borderWidth: 1.5,
    borderColor: C.blue,
    backgroundColor: C.blueSoft,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  cameraButtonText: {
    color: C.blueDeep,
    fontSize: 14,
    fontFamily: F.sansBold,
    letterSpacing: 0.5,
  },
  imageContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: C.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.blueLine,
  },
  labelImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  removePhoto: {
    alignSelf: "center",
    padding: 8,
  },
  removePhotoText: {
    color: C.danger,
    fontSize: 13,
    fontFamily: F.sansMed,
  },
  photoNote: {
    color: C.inkSoft,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingBottom: 6,
    fontFamily: F.sans,
  },
  pinkButton: {
    backgroundColor: C.pink,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
    shadowColor: C.pink,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pinkButtonText: {
    color: "#7A2C4D",
    fontSize: 14,
    fontFamily: F.sansBold,
    letterSpacing: 0.4,
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.blueLine,
  },
  dividerText: {
    color: C.inkMute,
    fontSize: 11,
    fontFamily: F.sansBold,
    letterSpacing: 2,
  },
  input: {
    minHeight: 125,
    borderWidth: 1.5,
    borderColor: C.blueLine,
    borderRadius: 18,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    color: C.ink,
    backgroundColor: C.bg,
    fontFamily: F.sans,
  },
  analyzeButton: {
    backgroundColor: C.blueDark,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 16,
    shadowColor: C.blueDark,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.65,
  },
  analyzeButtonText: {
    color: C.white,
    fontSize: 15,
    fontFamily: F.sansBold,
    letterSpacing: 0.6,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    backgroundColor: C.dangerSoft,
    borderRadius: 14,
    marginTop: 14,
    overflow: "hidden",
  },
  errorBar: {
    width: 4,
    backgroundColor: C.danger,
  },
  error: {
    flex: 1,
    color: "#A63A50",
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    fontFamily: F.sansMed,
  },

  // Results
  results: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: C.blueLine,
    paddingTop: 20,
  },
  resultsTitle: {
    color: C.ink,
    fontSize: 28,
    fontFamily: F.serifBold,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  summaryNumber: {
    fontSize: 30,
    fontFamily: F.serifBold,
  },
  summaryLabel: {
    color: C.inkSoft,
    fontSize: 11,
    marginTop: 2,
    fontFamily: F.sansMed,
    letterSpacing: 0.6,
  },
  resultItem: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.blueLine,
    borderLeftWidth: 5,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  resultName: {
    flex: 1,
    color: C.ink,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: F.serifBold,
  },
  resultBadge: {
    fontSize: 10,
    fontFamily: F.sansBold,
    overflow: "hidden",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    letterSpacing: 0.5,
  },
  identifiedBadge: {
    color: "#1F7360",
    backgroundColor: C.goodSoft,
  },
  unknownBadge: {
    color: C.pinkDark,
    backgroundColor: C.pinkSoft,
  },
  resultDetail: {
    color: C.inkSoft,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    fontFamily: F.sans,
  },
  resultDetailStrong: {
    color: C.ink,
    fontFamily: F.sansMed,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  categoryLabel: {
    color: C.inkSoft,
    fontSize: 12,
    fontFamily: F.sansMed,
  },
  categoryChip: {
    backgroundColor: C.pinkSoft,
    borderColor: C.pinkLine,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryChipText: {
    color: C.pinkDark,
    fontSize: 12,
    fontFamily: F.sansMed,
  },
  resultDescription: {
    color: C.inkSoft,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    fontFamily: F.sans,
  },
  detailBlock: {
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  detailLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  detailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: F.sansBold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  detailText: {
    color: C.ink,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: F.sans,
  },

  // Note
  noteCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: C.pinkSoft,
    borderWidth: 1,
    borderColor: C.pinkLine,
    borderRadius: 22,
    padding: 18,
    marginTop: 20,
  },
  noteIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.pink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  noteIconText: {
    color: C.white,
    fontSize: 14,
    fontFamily: F.serifBold,
  },
  noteTitle: {
    color: C.pinkDark,
    fontSize: 20,
    fontFamily: F.serifBold,
  },
  noteText: {
    color: C.inkSoft,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
    fontFamily: F.sans,
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: 18,
  },
  resetText: {
    color: C.blueDark,
    fontSize: 14,
    fontFamily: F.sansBold,
    letterSpacing: 0.4,
  },
  footerWrap: {
    alignItems: "center",
    marginTop: 4,
  },
  footerLogo: {
    width: 30,
    height: 30,
    marginBottom: 8,
    opacity: 0.9,
  },
  footer: {
    textAlign: "center",
    color: C.inkMute,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: F.sansMed,
  },
});