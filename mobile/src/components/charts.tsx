import { themedStyles } from '../theme';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

export interface LinePoint {
  label: string;
  value: number;
  secondary?: number;
}

function chartWidth(screenWidth: number) {
  return Math.min(Math.max(screenWidth - 72, 250), 620);
}

export function LineChart({ points, suffix = '', target }: { points: LinePoint[]; suffix?: string; target?: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = chartWidth(screenWidth);
  const height = 220;
  const pad = { left: 42, right: 12, top: 16, bottom: 28 };
  if (!points.length) return <View style={styles.empty}><Text style={styles.emptyText}>Add at least two measurements to draw this trend.</Text></View>;
  const values = points.flatMap((point) => [point.value, point.secondary].filter((value): value is number => value !== undefined));
  if (target !== undefined) values.push(target);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const margin = Math.max((max - min) * 0.15, max * 0.02, 1);
  min -= margin;
  max += margin;
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (points.length === 1 ? innerWidth / 2 : index / (points.length - 1) * innerWidth);
  const y = (value: number) => pad.top + (max - value) / (max - min) * innerHeight;
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ');
  const secondary = points.filter((point) => point.secondary !== undefined);
  const secondaryPath = secondary.map((point, index) => {
    const originalIndex = points.indexOf(point);
    return `${index ? 'L' : 'M'} ${x(originalIndex)} ${y(point.secondary as number)}`;
  }).join(' ');
  const areaPath = `${linePath} L ${x(points.length - 1)} ${pad.top + innerHeight} L ${x(0)} ${pad.top + innerHeight} Z`;
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  return (
    <Svg width={width} height={height}>
      <Defs><LinearGradient id="area" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.coral} stopOpacity="0.24" /><Stop offset="1" stopColor={colors.coral} stopOpacity="0.01" /></LinearGradient></Defs>
      {[0, 1, 2, 3].map((step) => {
        const value = min + (max - min) * step / 3;
        const lineY = y(value);
        return <G key={step}><Line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} stroke={colors.line} strokeWidth="1" /><SvgText x={pad.left - 7} y={lineY + 3} fill={colors.faint} fontSize="9" textAnchor="end">{value.toFixed(value < 20 ? 1 : 0)}{suffix}</SvgText></G>;
      })}
      {target !== undefined ? <Line x1={pad.left} x2={width - pad.right} y1={y(target)} y2={y(target)} stroke={colors.gold} strokeWidth="2" strokeDasharray="5 5" /> : null}
      <Path d={areaPath} fill="url(#area)" />
      {secondaryPath ? <Path d={secondaryPath} fill="none" stroke={colors.pine} strokeWidth="2.5" strokeDasharray="6 4" /> : null}
      <Path d={linePath} fill="none" stroke={colors.coral} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <Circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r={points.length > 16 ? 2 : 3.5} fill={colors.card} stroke={colors.coral} strokeWidth="2" />)}
      {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1 ? <SvgText key={`label-${index}`} x={x(index)} y={height - 8} fill={colors.faint} fontSize="9" textAnchor="middle">{point.label}</SvgText> : null)}
    </Svg>
  );
}

export function BarChart({ points }: { points: Array<{ label: string; value: number; target?: number }> }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = chartWidth(screenWidth);
  const height = 210;
  const pad = { left: 36, right: 8, top: 12, bottom: 28 };
  const max = Math.max(...points.flatMap((point) => [point.value, point.target || 0]), 1) * 1.1;
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const slot = innerWidth / Math.max(points.length, 1);
  const barWidth = Math.max(1, Math.min(slot * 0.58, 25));
  const y = (value: number) => pad.top + (max - value) / max * innerHeight;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((ratio) => <G key={ratio}><Line x1={pad.left} x2={width - pad.right} y1={y(max * ratio)} y2={y(max * ratio)} stroke={colors.line} /><SvgText x={pad.left - 6} y={y(max * ratio) + 3} textAnchor="end" fontSize="9" fill={colors.faint}>{Math.round(max * ratio)}</SvgText></G>)}
      {points.map((point, index) => {
        const center = pad.left + slot * index + slot / 2;
        const top = y(point.value);
        return <G key={`${point.label}-${index}`}><Rect x={center - barWidth / 2} y={top} width={barWidth} height={pad.top + innerHeight - top} rx={barWidth / 2} fill={point.value > (point.target || Infinity) * 1.1 ? colors.coral : colors.pine} opacity={point.value ? 1 : 0.18} />{point.target ? <Line x1={center - barWidth / 1.2} x2={center + barWidth / 1.2} y1={y(point.target)} y2={y(point.target)} stroke={colors.gold} strokeWidth="2.5" /> : null}{index % labelEvery === 0 || index === points.length - 1 ? <SvgText x={center} y={height - 8} textAnchor="middle" fontSize="9" fill={colors.faint}>{point.label}</SvgText> : null}</G>;
      })}
    </Svg>
  );
}

export function DonutChart({ segments, centerLabel }: { segments: Array<{ label: string; value: number }>; centerLabel: string }) {
  const size = 154;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let offset = 0;
  return (
    <View style={styles.donutRow}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.paperDeep} strokeWidth="18" />
        {segments.map((segment, index) => {
          const length = segment.value / total * circumference;
          const shade = index === 0 ? colors.pine : index === 1 ? colors.muted : colors.faint;
          const circle = <Circle key={segment.label} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={shade} strokeWidth="18" strokeLinecap="butt" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} rotation="-90" origin={`${size / 2}, ${size / 2}`} />;
          offset += length;
          return circle;
        })}
        <SvgText x={size / 2} y={size / 2 - 3} textAnchor="middle" fill={colors.ink} fontSize="21" fontWeight="900">{centerLabel}</SvgText>
        <SvgText x={size / 2} y={size / 2 + 15} textAnchor="middle" fill={colors.muted} fontSize="9">macro split</SvgText>
      </Svg>
      <View style={styles.legend}>{segments.map((segment, index) => <View key={segment.label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: index === 0 ? colors.pine : index === 1 ? colors.muted : colors.faint }]} /><View><Text style={styles.legendValue}>{total ? (segment.value / total * 100).toFixed(0) : 0}%</Text><Text style={styles.legendLabel}>{segment.label}</Text></View></View>)}</View>
    </View>
  );
}

export function ConsistencyGrid({ points }: { points: Array<{ logged: boolean; calories: number; goalCalories?: number }> }) {
  return <View style={styles.grid}>{points.map((point, index) => {
    const onTarget = Boolean(point.logged && point.goalCalories && Math.abs(point.calories - point.goalCalories) <= point.goalCalories * 0.1);
    return <View key={index} style={[styles.gridCell, point.logged && styles.gridLogged, onTarget && styles.gridTarget]} />;
  })}</View>;
}

const styles = themedStyles(() => ({
  empty: { height: 170, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 19 },
  donutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  legend: { gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendValue: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  legendLabel: { color: colors.muted, fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  gridCell: { width: 14, height: 14, borderRadius: 4, backgroundColor: colors.paperDeep },
  gridLogged: { backgroundColor: colors.muted },
  gridTarget: { backgroundColor: colors.pine }
}));
